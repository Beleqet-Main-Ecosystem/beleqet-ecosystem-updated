import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob, Queue } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaWebhookPayload } from '../chapa/chapa.types';

const EscrowJobs: any = ESCROW_JOBS;

type WebhookPayload = ChapaWebhookPayload;

interface AutoReleasePayload {
  milestoneId: string;
  freelancerId: string;
  amount: number;
  releaseAt: string;
}

interface UnlockFundsPayload {
  escrowId: string;
  clientId: string;
  amount: number;
}

@Injectable()
@Processor(QUEUE_NAMES.ESCROW)
export class EscrowProcessor extends WorkerHost {
  private readonly logger = new Logger(EscrowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chapaClient: ChapaClient,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ESCROW)
    private readonly escrowQueue: Queue,
  ) {
    super();
  }

  async process(job: BullJob<any, any, string>): Promise<any> {
    switch (job.name) {
      case EscrowJobs.PROCESS_WEBHOOK:
        await this.handleWebhook(job);
        break;
      case EscrowJobs.AUTO_RELEASE:
        await this.handleAutoRelease(job);
        break;

      case EscrowJobs.UNLOCK_FUNDS:
        await this.handleUnlockFunds(job);
        break;
      default:
        this.logger.warn(`Unknown job execution path: ${job.name}`);
    }
  }

  /**
   * Processes Chapa payment webhooks idempotently. Successful payment events
   * are always re-verified against Chapa before the escrow and freelance gig
   * move to FUNDED.
   */
  async handleWebhook(job: BullJob<WebhookPayload>) {
    const txRef = String(job.data.tx_ref ?? job.data.trx_ref ?? job.data.reference ?? '');
    const reference = String(job.data.reference ?? txRef);
    const status = String(job.data.status ?? '');
    const eventName = String(job.data.event ?? job.data.type ?? 'payment');
    const eventKey = `${eventName}:${txRef}:${reference}:${status || 'no-status'}`;
    this.logger.log(`[escrow-webhook] txRef=${txRef} reference=${reference} status=${status}`);

    const alreadyProcessed = await this.prisma.eventLog.findFirst({
      where: { eventType: 'chapa.webhook.processed', entityId: eventKey },
    });
    if (alreadyProcessed) {
      this.logger.debug(`[escrow-webhook] Duplicate event skipped: ${eventKey}`);
      return;
    }

    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: { OR: [{ gatewayRef: txRef }, { gatewayRef: reference }] },
      include: { freelanceJob: { include: { client: true } } },
    });

    if (!escrow) {
      this.logger.warn(`[escrow-webhook] No escrow found for txRef=${txRef || reference}`);
      return;
    }

    if (escrow.status === 'FUNDED') {
      await this.markWebhookProcessed(eventKey, escrow.id, job.data);
      this.logger.debug(`[escrow-webhook] Already funded, skipping`);
      return;
    }

    const isSuccessful = eventName === 'charge.success' || status.toLowerCase() === 'success';
    if (isSuccessful) {
      const providerTxRef = escrow.gatewayRef ?? txRef;
      const verified = await this.chapaClient.verifyTransaction(providerTxRef);
      const verifiedData = verified.data;
      const expectedChapaAmount = escrow.grossAmount - escrow.walletAppliedAmount;

      if (
        verifiedData?.status !== 'success' ||
        verifiedData.tx_ref !== providerTxRef ||
        verifiedData.currency !== escrow.currency ||
        !this.amountMatches(verifiedData.amount, expectedChapaAmount)
      ) {
        throw new Error(`Chapa verification mismatch for escrow ${escrow.id}`);
      }

      const funded = await this.prisma.$transaction(async (tx) => {
        const claim = await tx.escrowTransaction.updateMany({
          where: { id: escrow.id, status: { notIn: ['FUNDED', 'REFUNDED'] } },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            gatewayResponse: verified as object,
          },
        });

        if (claim.count === 0) {
          return false;
        }

        await tx.freelanceJob.update({
          where: { id: escrow.freelanceJobId },
          data: { status: 'FUNDED' },
        });

        if (escrow.walletAppliedAmount > 0) {
          const wallet = await tx.employerWallet.findUnique({
            where: { userId: escrow.freelanceJob.clientId },
          });
          if (wallet) {
            await tx.employerWallet.update({
              where: { id: wallet.id },
              data: { lockedBalance: { decrement: escrow.walletAppliedAmount } },
            });
            await tx.employerWalletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'DEBIT_WITHDRAWAL',
                amount: escrow.walletAppliedAmount,
                note: `Partially funded escrow for job ${escrow.freelanceJobId}`,
                escrowId: escrow.id,
              },
            });
          }
        }

        await tx.eventLog.create({
          data: {
            eventType: 'escrow.funded',
            entityId: escrow.id,
            entityType: 'EscrowTransaction',
            payload: { amount: escrow.grossAmount, txRef: providerTxRef },
            processedBy: EscrowProcessor.name,
          },
        });

        await tx.eventLog.create({
          data: {
            eventType: 'chapa.webhook.processed',
            entityId: eventKey,
            entityType: 'EscrowTransaction',
            payload: { escrowId: escrow.id, ...job.data },
            processedBy: EscrowProcessor.name,
          },
        });

        return true;
      });

      if (!funded) {
        this.logger.debug(`[escrow-webhook] Webhook lost race, already processed: ${eventKey}`);
        return;
      }

      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: escrow.freelanceJob.clientId,
        type: 'escrow.funded',
        title: 'Escrow funded - your gig is now live',
        body: `${escrow.currency} ${escrow.grossAmount.toLocaleString()} has been secured.`,
        metadata: { escrowId: escrow.id, freelanceJobId: escrow.freelanceJobId },
      });

      this.logger.log(`[escrow-webhook] Escrow ${escrow.id} funded after Chapa verification`);
      return;
    }

    await this.prisma.escrowTransaction.update({
      where: { id: escrow.id },
      data: { gatewayResponse: job.data as object },
    });
    await this.markWebhookProcessed(eventKey, escrow.id, job.data);
    this.logger.warn(`[escrow-webhook] Payment failed for escrow ${escrow.id}`);
    if (escrow.walletAppliedAmount > 0) {
      await this.releaseLockedFunds(
        escrow.id,
        escrow.freelanceJob.clientId,
        escrow.walletAppliedAmount,
      );
    }
  }

  async handleAutoRelease(job: BullJob<AutoReleasePayload>) {
    const { milestoneId, freelancerId, amount } = job.data;
    this.logger.log(
      `[auto-release] Processing milestone ${milestoneId} for freelancer ${freelancerId}`,
    );

    const releaseAt = new Date(job.data.releaseAt);
    if (releaseAt > new Date()) {
      const delayMs = releaseAt.getTime() - Date.now();
      await this.escrowQueue.add(EscrowJobs.AUTO_RELEASE, job.data, {
        delay: delayMs,
        jobId: `auto-release:${milestoneId}`,
      });
      return;
    }

    const credited = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "milestones" WHERE id = ${milestoneId} FOR UPDATE`;

      const alreadyCredited = await tx.eventLog.findFirst({
        where: { eventType: 'wallet.credited', entityId: milestoneId },
      });
      if (alreadyCredited) {
        return false;
      }

      const wallet = await tx.freelancerWallet.upsert({
        where: { userId: freelancerId },
        update: {
          pendingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
        create: {
          userId: freelancerId,
          pendingBalance: 0,
          availableBalance: amount,
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT_AVAILABLE',
          amount,
          note: 'Milestone payout cleared - 3-day hold complete',
          milestoneId,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'wallet.credited',
          entityId: milestoneId,
          entityType: 'Milestone',
          payload: { milestoneId, freelancerId, amount },
          processedBy: EscrowProcessor.name,
        },
      });

      return true;
    });

    if (!credited) {
      this.logger.debug(`[auto-release] Milestone ${milestoneId} already credited; skipping`);
      return;
    }

    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
      userId: freelancerId,
      type: 'wallet.credited',
      title: `ETB ${amount.toLocaleString()} is now available`,
      body: 'Your hold period has cleared. You can now withdraw these funds.',
      metadata: { milestoneId, amount },
    });

    const user = await this.prisma.user.findUnique({ where: { id: freelancerId } });
    if (user?.telegramId) {
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
        telegramId: user.telegramId,
        message: `ETB ${amount.toLocaleString()} is now available in your Beleqet wallet. Withdraw at: ${this.config.get('FRONTEND_URL')}/freelance/wallet`,
      });
    }

    this.logger.log(
      `[auto-release] ETB ${amount} moved to available for freelancer ${freelancerId}`,
    );
  }

  async handleUnlockFunds(job: BullJob<UnlockFundsPayload>) {
    const { escrowId, clientId, amount } = job.data;
    this.logger.log(
      `[unlock-funds] Checking if escrow ${escrowId} needs unlocking for user ${clientId}`,
    );
    await this.releaseLockedFunds(escrowId, clientId, amount);
  }

  private async releaseLockedFunds(escrowId: string, clientId: string, amount: number) {
    const released = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const wallet = await tx.employerWallet.findUnique({ where: { userId: clientId } });
      if (!wallet) return false;

      const refundClaim = await tx.escrowTransaction.updateMany({
        where: { id: escrowId, status: { notIn: ['FUNDED', 'REFUNDED'] } },
        data: { status: 'REFUNDED' },
      });
      if (refundClaim.count === 0) {
        return false;
      }

      await tx.employerWallet.update({
        where: { id: wallet.id },
        data: {
          lockedBalance: { decrement: amount },
          balance: { increment: amount },
        },
      });

      await tx.employerWalletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'CREDIT_AVAILABLE',
          amount,
          note: `Refund for failed/abandoned escrow ${escrowId}`,
          escrowId,
        },
      });

      return true;
    });

    if (!released) return;

    this.logger.log(
      `[unlock-funds] Released ETB ${amount} back to employer ${clientId} for abandoned escrow ${escrowId}`,
    );
  }

  private processedEventLog(eventKey: string, escrowId: string, payload: WebhookPayload) {
    return this.prisma.eventLog.create({
      data: {
        eventType: 'chapa.webhook.processed',
        entityId: eventKey,
        entityType: 'EscrowTransaction',
        payload: { escrowId, ...payload },
        processedBy: EscrowProcessor.name,
      },
    });
  }

  private async markWebhookProcessed(eventKey: string, escrowId: string, payload: WebhookPayload) {
    await this.processedEventLog(eventKey, escrowId, payload);
  }

  private amountMatches(
    providerAmount: string | number | undefined,
    expectedAmount: number,
  ): boolean {
    const normalized = Number(providerAmount);
    return Number.isFinite(normalized) && Math.abs(normalized - expectedAmount) < 0.01;
  }

  @OnWorkerEvent('failed')
  handleJobFailure(job: BullJob | undefined, error: Error) {
    this.logger.error(
      `Job ${job?.id || 'unknown'} failed with error: ${error.message}`,
      error.stack,
    );
  }
}
