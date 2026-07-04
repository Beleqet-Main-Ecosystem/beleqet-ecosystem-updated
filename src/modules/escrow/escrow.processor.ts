import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob } from 'bull';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QUEUE_NAMES,
  ESCROW_JOBS,
  NOTIFICATION_JOBS,
} from '../queues/queues.constants';

// ── Payload Types ─────────────────────────────────────────────────────────────

interface WebhookPayload {
  reference: string;
  status: string;
  amount?: number;
  currency?: string;
  tx_ref?: string;
  [key: string]: unknown;
}

interface AutoReleasePayload {
  milestoneId: string;
  freelancerId: string;
  amount: number;
  releaseAt: string;
}

interface WithdrawalPayload {
  walletId: string;
  userId: string;
  amount: number;
  method: string;
  accountRef: string;
}

@Injectable()
@Processor(QUEUE_NAMES.ESCROW)
export class EscrowProcessor {
  private readonly logger = new Logger(EscrowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
  ) {}

  // ── 1. Process Chapa / Telebirr Webhook ───────────────────────────────────

  @Process(ESCROW_JOBS.PROCESS_WEBHOOK)
  async handleWebhook(job: BullJob<WebhookPayload>) {
    const { reference, status, tx_ref } = job.data;
    this.logger.log(`[escrow-webhook] ref=${reference} status=${status}`);

    // Locate the escrow record by gateway reference or tx_ref
    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: {
        OR: [
          { gatewayRef: reference },
          { gatewayRef: tx_ref },
        ],
      },
      include: {
        freelanceJob: { include: { client: true } },
      },
    });

    if (!escrow) {
      this.logger.warn(`[escrow-webhook] No escrow found for ref=${reference}`);
      return;
    }

    // Idempotency — skip if already funded
    if (escrow.status === 'FUNDED') {
      this.logger.debug(`[escrow-webhook] Already funded, skipping`);
      return;
    }

    if (status === 'success' || status === 'SUCCESS') {
      // Mark escrow as funded and publish the gig
      const transactions = [
        this.prisma.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            gatewayResponse: job.data as object,
          },
        }),
        this.prisma.freelanceJob.update({
          where: { id: escrow.freelanceJobId },
          data: { status: 'FUNDED' },
        }),
      ];

      // If wallet applied, deduct from locked balance and log transaction
      if (escrow.walletAppliedAmount > 0) {
        const wallet = await this.prisma.employerWallet.findUnique({
          where: { userId: escrow.freelanceJob.clientId }
        });
        if (wallet) {
          transactions.push(
            this.prisma.employerWallet.update({
              where: { id: wallet.id },
              data: { lockedBalance: { decrement: escrow.walletAppliedAmount } }
            }) as never
          );
          transactions.push(
            this.prisma.employerWalletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'DEBIT_WITHDRAWAL',
                amount: escrow.walletAppliedAmount,
                note: `Partially funded escrow for job ${escrow.freelanceJobId}`,
                escrowId: escrow.id,
              }
            }) as never
          );
        }
      }

      transactions.push(
        this.prisma.eventLog.create({
          data: {
            eventType: 'escrow.funded',
            entityId: escrow.id,
            entityType: 'EscrowTransaction',
            payload: { amount: escrow.grossAmount },
            processedBy: EscrowProcessor.name,
          },
        }) as never
      );

      await this.prisma.$transaction(transactions);

      // Notify the client
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: escrow.freelanceJob.clientId,
        type: 'escrow.funded',
        title: '✅ Escrow funded — your gig is now live!',
        body: `ETB ${escrow.grossAmount.toLocaleString()} has been secured. Freelancers can now bid on your project.`,
        metadata: { escrowId: escrow.id, freelanceJobId: escrow.freelanceJobId },
      });

      this.logger.log(`[escrow-webhook] Escrow ${escrow.id} funded — gig published`);
    } else {
      // Payment failed
      await this.prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { gatewayResponse: job.data as object },
      });
      this.logger.warn(`[escrow-webhook] Payment failed for escrow ${escrow.id}`);
    }
  }

  // ── 2. Auto-Release Milestone After 3-Day Hold ────────────────────────────

  @Process(ESCROW_JOBS.AUTO_RELEASE)
  async handleAutoRelease(job: BullJob<AutoReleasePayload>) {
    const { milestoneId, freelancerId, amount } = job.data;
    this.logger.log(`[auto-release] Processing milestone ${milestoneId} for freelancer ${freelancerId}`);

    // Check the hold period has actually elapsed (job may fire slightly early)
    const releaseAt = new Date(job.data.releaseAt);
    if (releaseAt > new Date()) {
      // Re-queue with the correct delay
      const delayMs = releaseAt.getTime() - Date.now();
      await job.queue.add(ESCROW_JOBS.AUTO_RELEASE, job.data, { delay: delayMs });
      this.logger.debug(`[auto-release] Hold not elapsed, re-queued with ${delayMs}ms delay`);
      return;
    }

    // Move funds from pending → available in the freelancer wallet
    const wallet = await this.prisma.freelancerWallet.upsert({
      where: { userId: freelancerId },
      update: {
        pendingBalance:   { decrement: amount },
        availableBalance: { increment: amount },
      },
      create: {
        userId: freelancerId,
        pendingBalance: 0,
        availableBalance: amount,
      },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId: wallet.id,
        type: 'CREDIT_AVAILABLE',
        amount,
        note: `Milestone payout cleared — 3-day hold complete`,
        milestoneId,
      },
    });

    await this.prisma.eventLog.create({
      data: {
        eventType: 'wallet.credited',
        entityId: milestoneId,
        entityType: 'Milestone',
        payload: { milestoneId, freelancerId, amount },
        processedBy: EscrowProcessor.name,
      },
    });

    // Notify freelancer
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: freelancerId,
      type: 'wallet.credited',
      title: `💰 ETB ${amount.toLocaleString()} is now available`,
      body: 'Your hold period has cleared. You can now withdraw these funds.',
      metadata: { milestoneId, amount },
    });

    // Telegram notification
    const user = await this.prisma.user.findUnique({ where: { id: freelancerId } });
    if (user?.telegramId) {
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
        telegramId: user.telegramId,
        message: `💰 *ETB ${amount.toLocaleString()} is now available in your Beleqet wallet!*\n\nYour 3-day hold has cleared. Withdraw at: ${this.config.get('FRONTEND_URL')}/freelance/wallet`,
      });
    }

    this.logger.log(`[auto-release] ETB ${amount} moved to available for freelancer ${freelancerId}`);
  }

  // ── 3. Process Withdrawal ─────────────────────────────────────────────────

  @Process(ESCROW_JOBS.PROCESS_WITHDRAWAL)
  async handleWithdrawal(job: BullJob<WithdrawalPayload>) {
    const { userId, amount, method } = job.data;
    this.logger.log(`[withdrawal] Processing ETB ${amount} via ${method} for user ${userId}`);

    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    if (chapaSecret) {
      try {
        const response = await fetch('https://api.chapa.co/v1/transfers', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${chapaSecret}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            account_name: 'Freelancer',
            account_number: job.data.accountRef,
            amount: amount.toString(),
            currency: 'ETB',
            reference: `withdrawal-${job.id}`,
            bank_code: method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513', // Use 855 for Telebirr
          }),
        });

        const data = await response.json();
        if (data.status !== 'success') {
          this.logger.warn(`Chapa payout queue failed: ${data.message}`);
        }
      } catch (err) {
        this.logger.error(`Failed to reach Chapa payout queue: ${(err as Error).message}`);
      }
    }

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId,
      type: 'wallet.withdrawal_processing',
      title: `Withdrawal of ETB ${amount.toLocaleString()} is processing`,
      body: `Your ${method} withdrawal is being processed. Funds typically arrive within 1–2 business days.`,
      metadata: { amount, method },
    });

    this.logger.log(`[withdrawal] ETB ${amount} payout initiated via ${method}`);
  }

  // ── Error Handler ─────────────────────────────────────────────────────────

  @OnQueueFailed()
  onFailed(job: BullJob, error: Error) {
    this.logger.error(
      `[escrow-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`,
      error.stack,
    );
  }
}
