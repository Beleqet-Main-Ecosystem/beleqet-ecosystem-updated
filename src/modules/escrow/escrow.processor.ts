import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';

import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';

interface WebhookPayload {
  reference: string;
  status: string;
  amount?: number;
  currency?: string;
  tx_ref?: string;

  timestamp?: string | number;
  created_at?: string | number;
  createdAt?: string | number;

  [key: string]: unknown;
}

interface AutoReleasePayload {
  milestoneId: string;
  freelancerId: string;
  amount: number;
  releaseAt: string;
}

interface CancelChapaPaymentPayload {
  escrowId: string;
  gatewayRef: string;
  clientId: string;
}

@Injectable()
@Processor(QUEUE_NAMES.ESCROW)
export class EscrowProcessor extends WorkerHost {
  private readonly logger = new Logger(EscrowProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ESCROW)
    private readonly escrowQueue: Queue,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    this.logger.log(`Processing escrow job ${job.id} of type ${job.name}`);
    try {
      switch (job.name) {
        case ESCROW_JOBS.PROCESS_WEBHOOK:
          return await this.handleWebhook(job as Job<WebhookPayload>);
        case ESCROW_JOBS.AUTO_RELEASE:
          return await this.handleAutoRelease(job as Job<AutoReleasePayload>);
        case ESCROW_JOBS.CANCEL_CHAPA_PAYMENT:
          return await this.handleCancelChapaPayment(job as Job<CancelChapaPaymentPayload>);
        case ESCROW_JOBS.UNLOCK_FUNDS:
          return await this.handleUnlockFunds(
            job as Job<{ escrowId: string; clientId: string; amount: number }>,
          );
        default:
          this.logger.warn(`Unknown escrow job: ${job.name}`);
      }
    } catch (error) {
      this.logger.error(
        `[escrow-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  async handleWebhook(job: Job<WebhookPayload>) {
    const { reference, status, tx_ref } = job.data;
    this.logger.log(`[escrow-webhook] ref=${reference} status=${status}`);

    if (!reference || !status || !tx_ref) {
      this.logger.warn(`[escrow-webhook] Invalid payload: missing required fields`, job.data);
      return;
    }

    const timestamp = job.data.timestamp || job.data.created_at || job.data.createdAt;
    const isTerminal =
      status === 'success' ||
      status === 'SUCCESS' ||
      status === 'failure' ||
      status === 'FAILED' ||
      status === 'cancelled';
    if (isTerminal) {
      if (!timestamp) {
        this.logger.warn(
          `[escrow-webhook] Terminal status "${status}" payload missing timestamp — rejecting as replay protection`,
        );
        return;
      }
      const payloadTime = new Date(timestamp).getTime();
      if (Number.isNaN(payloadTime)) {
        this.logger.warn(`[escrow-webhook] Invalid timestamp value: ${timestamp} — rejecting`);
        return;
      }
      const now = Date.now();
      const FIFTEEN_MINUTES = 15 * 60 * 1000;
      if (now - payloadTime > FIFTEEN_MINUTES) {
        this.logger.warn(`[escrow-webhook] Payload too old (replay?), age=${now - payloadTime}ms`);
        return;
      }
    }

    const escrow = await this.prisma.escrowTransaction.findFirst({
      where: {
        OR: [{ gatewayRef: reference }, { gatewayRef: tx_ref }],
      },
      include: {
        freelanceJob: { include: { client: true } },
      },
    });

    if (!escrow) {
      this.logger.warn(`[escrow-webhook] No escrow found for ref=${reference}`);
      return;
    }

    if (escrow.status === 'FUNDED') {
      this.logger.debug(`[escrow-webhook] Already funded, skipping`);
      return;
    }

    if (status === 'pending' || status === 'PENDING') {
      this.logger.log(
        `[escrow-webhook] Payment pending for escrow ${escrow.id}, awaiting final result`,
      );

      await this.prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: { gatewayResponse: job.data as object },
      });
      return;
    }

    if (status === 'success' || status === 'SUCCESS') {
      await this.prisma.$transaction(async (tx) => {
        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            status: 'FUNDED',
            fundedAt: new Date(),
            gatewayResponse: job.data as object,
          },
        });

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
            payload: { amount: escrow.grossAmount },
            processedBy: EscrowProcessor.name,
          },
        });
      });

      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: escrow.freelanceJob.clientId,
        type: 'escrow.funded',
        title: this.i18n.t('notifications.escrow.notification.fundedTitle', {
          defaultValue: 'Escrow funded — your gig is now live!',
        }),
        body: this.i18n.t('notifications.escrow.notification.fundedBody', {
          args: { currency: escrow.currency, amount: escrow.grossAmount.toLocaleString() },
          defaultValue:
            '{currency} {amount} has been secured. Freelancers can now bid on your project.',
        }),
        metadata: { escrowId: escrow.id, freelanceJobId: escrow.freelanceJobId },
      });

      this.logger.log(`[escrow-webhook] Escrow ${escrow.id} funded — gig published`);
    } else {
      await this.prisma.escrowTransaction.update({
        where: { id: escrow.id },
        data: {
          status: 'REFUNDED',
          gatewayResponse: job.data as object,
        },
      });

      if (escrow.walletAppliedAmount > 0) {
        const wallet = await this.prisma.employerWallet.findUnique({
          where: { userId: escrow.freelanceJob.clientId },
        });
        if (wallet) {
          await this.prisma.$transaction([
            this.prisma.employerWallet.update({
              where: { id: wallet.id },
              data: {
                lockedBalance: { decrement: escrow.walletAppliedAmount },
                balance: { increment: escrow.walletAppliedAmount },
              },
            }),
            this.prisma.employerWalletTransaction.create({
              data: {
                walletId: wallet.id,
                type: 'CREDIT_AVAILABLE',
                amount: escrow.walletAppliedAmount,
                note: `Refund for failed Chapa payment on escrow ${escrow.id}`,
                escrowId: escrow.id,
              },
            }),
          ]);
        }
      }

      this.logger.warn(
        `[escrow-webhook] Payment failed for escrow ${escrow.id} — status set to REFUNDED`,
      );
    }
  }

  async handleAutoRelease(job: Job<AutoReleasePayload>) {
    const { milestoneId, freelancerId, amount, releaseAt } = job.data;

    try {
      if (!milestoneId || !freelancerId || typeof amount !== 'number' || !releaseAt) {
        this.logger.warn(`[auto-release] Invalid payload: missing required fields`, job.data);
        return;
      }
      if (amount <= 0) {
        this.logger.warn(`[auto-release] Invalid amount: ${amount}`);
        return;
      }

      this.logger.log(
        `[auto-release] Processing milestone ${milestoneId} for freelancer ${freelancerId}`,
      );

      const releaseTime = new Date(releaseAt);
      if (releaseTime > new Date()) {
        const delayMs = releaseTime.getTime() - Date.now();
        await this.escrowQueue.add(ESCROW_JOBS.AUTO_RELEASE, job.data, {
          delay: delayMs,
          jobId: `auto-release:${milestoneId}`,
        });
        this.logger.debug(`[auto-release] Hold not elapsed, re-queued with ${delayMs}ms delay`);
        return;
      }

      const isAdminForce = milestoneId.startsWith('admin-force:');

      if (!isAdminForce) {
        const milestone = await this.prisma.milestone.findUnique({ where: { id: milestoneId } });
        if (!milestone) {
          this.logger.warn(`[auto-release] Milestone ${milestoneId} not found, skipping`);
          return;
        }
        if (milestone.status !== 'APPROVED') {
          this.logger.log(
            `[auto-release] Milestone ${milestoneId} not yet approved (status=${milestone.status}), skipping`,
          );
          return;
        }
      }

      const _wallet = await this.prisma.$transaction(async (tx) => {
        const currentWallet = await tx.freelancerWallet.findUnique({
          where: { userId: freelancerId },
        });
        if (!currentWallet || currentWallet.pendingBalance < amount) {
          throw new Error(
            `Insufficient pending balance: ${currentWallet?.pendingBalance ?? 0} < ${amount}`,
          );
        }

        const updatedWallet = await tx.freelancerWallet.update({
          where: { userId: freelancerId },
          data: {
            pendingBalance: { decrement: amount },
            availableBalance: { increment: amount },
          },
        });

        await tx.walletTransaction.create({
          data: {
            walletId: updatedWallet.id,
            type: 'CREDIT_AVAILABLE',
            amount,
            note: 'Milestone payout cleared — 3-day hold complete',
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

        return updatedWallet;
      });

      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: freelancerId,
        type: 'wallet.credited',
        title: this.i18n.t('notifications.escrow.notification.autoReleaseTitle', {
          args: { amount: amount.toLocaleString() },
          defaultValue: 'ETB {amount} is now available',
        }),
        body: this.i18n.t('notifications.escrow.notification.autoReleaseBody', {
          defaultValue: 'Your hold period has cleared. You can now withdraw these funds.',
        }),
        metadata: { milestoneId, amount },
      });

      const user = await this.prisma.user.findUnique({ where: { id: freelancerId } });
      if (user?.telegramId) {
        const escapeMd = (text: string) =>
          text
            .replace(/\*/g, '\\*')
            .replace(/_/g, '\\_')
            .replace(/\[/g, '\\[')
            .replace(/`/g, '\\`');

        const safeAmount = escapeMd(amount.toLocaleString());
        const safeUrl = escapeMd(this.config.get('FRONTEND_URL') || '');

        await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_TELEGRAM, {
          telegramId: user.telegramId,
          message: this.i18n.t('notifications.escrow.notification.autoReleaseTelegram', {
            args: { amount: safeAmount, url: safeUrl },
            defaultValue:
              '*ETB {amount} is now available in your Beleqet wallet!*\n\nYour 3-day hold has cleared. Withdraw at: {url}/freelance/wallet',
          }),
        });
      }

      this.logger.log(
        `[auto-release] ETB ${amount} moved to available for freelancer ${freelancerId}`,
      );

      // ── Auto-complete contract if ALL milestones are now approved ──────────
      // Skip for admin-force-release jobs — already handled in adminForceRelease()
      if (!isAdminForce) {
        const contract = await this.prisma.contract.findFirst({
          where: { milestones: { some: { id: milestoneId } } },
          include: { milestones: true, freelanceJob: { include: { escrowTx: true } } },
        });

        if (contract && contract.status === 'ACTIVE') {
          const allApproved = contract.milestones.every((m) => m.status === 'APPROVED');
          if (allApproved) {
            await this.prisma.$transaction(async (tx) => {
              await tx.contract.update({
                where: { id: contract.id },
                data: { status: 'COMPLETED', completedAt: new Date() },
              });
              if (
                contract.freelanceJob.escrowTx &&
                contract.freelanceJob.escrowTx.status === 'FUNDED'
              ) {
                await tx.escrowTransaction.update({
                  where: { id: contract.freelanceJob.escrowTx.id },
                  data: { status: 'RELEASED', releasedAt: new Date() },
                });
              }
              await tx.freelanceJob.update({
                where: { id: contract.freelanceJobId },
                data: { status: 'COMPLETED' },
              });
              await tx.eventLog.create({
                data: {
                  eventType: 'contract.auto_completed',
                  entityId: contract.id,
                  entityType: 'Contract',
                  payload: {
                    milestoneCount: contract.milestones.length,
                    triggeredByMilestone: milestoneId,
                  },
                  processedBy: EscrowProcessor.name,
                },
              });
            });

            // Notify both parties
            for (const uid of [contract.clientId, contract.freelancerId]) {
              await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: uid,
                type: 'contract.completed',
                title: this.i18n.t('notifications.escrow.notification.contractCompletedTitle', {
                  defaultValue: 'Contract Completed',
                }),
                body: this.i18n.t(
                  'notifications.escrow.notification.contractCompletedAllApprovedBody',
                  {
                    defaultValue:
                      'All milestones have been approved and released. Your contract is now complete.',
                  },
                ),
                metadata: { contractId: contract.id },
              });
            }
            this.logger.log(
              `[auto-release] Contract ${contract.id} auto-completed — all ${contract.milestones.length} milestones approved`,
            );
          }
        }
      }
    } catch (error) {
      this.logger.error(
        `[auto-release] Failed for milestone ${milestoneId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error; // Re-throw for BullMQ retry
    }
  }

  // ── 3. Cancel Chapa Payment (Cancellation Cleanup) ────────────────────────

  async handleCancelChapaPayment(job: Job<CancelChapaPaymentPayload>) {
    const { escrowId, gatewayRef, clientId } = job.data;
    this.logger.log(`[cancel-chapa] Attempting to cancel Chapa payment for escrow ${escrowId}`);

    const logManualIntervention = async (reason: string) => {
      await this.prisma.eventLog.create({
        data: {
          eventType: 'escrow.chapa-cancel-manual-intervention',
          entityId: escrowId,
          entityType: 'EscrowTransaction',
          payload: { escrowId, gatewayRef, clientId, reason, processedBy: EscrowProcessor.name },
          processedBy: EscrowProcessor.name,
        },
      });
    };

    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    if (!chapaSecret) {
      this.logger.warn(`[cancel-chapa] CHAPA_SECRET_KEY not configured, cannot cancel`);
      await logManualIntervention(
        'CHAPA_SECRET_KEY not configured — funds held by Chapa require manual refund',
      );
      return;
    }

    try {
      // Call Chapa API to cancel/refund payment
      const response = await fetch(`https://api.chapa.co/v1/transaction/cancel/${gatewayRef}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${chapaSecret}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();
      if (data.status === 'success') {
        this.logger.log(`[cancel-chapa] Chapa payment cancelled for escrow ${escrowId}`);
        await this.prisma.eventLog.create({
          data: {
            eventType: 'escrow.chapa-cancel-success',
            entityId: escrowId,
            entityType: 'EscrowTransaction',
            payload: { escrowId, gatewayRef, clientId },
            processedBy: EscrowProcessor.name,
          },
        });
      } else {
        this.logger.warn(`[cancel-chapa] Chapa cancellation failed: ${data.message}`);
        await logManualIntervention(`Chapa cancellation failed: ${data.message}`);
      }
    } catch (err) {
      this.logger.error(`[cancel-chapa] Failed to reach Chapa: ${(err as Error).message}`);
      await logManualIntervention(`Network error: ${(err as Error).message}`);
    }
  }

  // ── 5. Unlock Wallet Funds (24h Timeout) ──────────────────────────────────

  async handleUnlockFunds(job: Job<{ escrowId: string; clientId: string; amount: number }>) {
    const { escrowId, clientId, amount } = job.data;
    this.logger.log(`[unlock-funds] Processing unlock for escrow ${escrowId}`);

    try {
      if (!escrowId || !clientId || typeof amount !== 'number' || amount <= 0) {
        this.logger.warn(`[unlock-funds] Invalid payload`, job.data);
        return;
      }

      const escrow = await this.prisma.escrowTransaction.findUnique({ where: { id: escrowId } });
      if (!escrow) {
        this.logger.warn(`[unlock-funds] Escrow ${escrowId} not found, skipping`);
        return;
      }

      // Only unlock if escrow is still PENDING (Chapa payment never completed)
      if (escrow.status !== 'PENDING') {
        this.logger.log(
          `[unlock-funds] Escrow ${escrowId} status=${escrow.status}, skipping unlock`,
        );
        return;
      }

      const wallet = await this.prisma.employerWallet.findUnique({ where: { userId: clientId } });
      if (!wallet) {
        this.logger.warn(`[unlock-funds] Wallet not found for client ${clientId}, skipping`);
        return;
      }

      // Idempotency: check if locked balance is sufficient
      if (wallet.lockedBalance < amount) {
        this.logger.warn(
          `[unlock-funds] Insufficient locked balance: ${wallet.lockedBalance} < ${amount}, skipping`,
        );
        return;
      }

      // Refund locked balance → available balance
      await this.prisma.$transaction([
        this.prisma.employerWallet.update({
          where: { userId: clientId },
          data: {
            lockedBalance: { decrement: amount },
            balance: { increment: amount },
          },
        }),
        this.prisma.employerWalletTransaction.create({
          data: {
            walletId: wallet.id,
            type: 'CREDIT_AVAILABLE',
            amount,
            note: `Wallet funds unlocked — Chapa payment not completed for escrow ${escrowId}`,
            escrowId,
          },
        }),
        this.prisma.eventLog.create({
          data: {
            eventType: 'wallet.unlocked',
            entityId: escrowId,
            entityType: 'EscrowTransaction',
            payload: { escrowId, clientId, amount },
            processedBy: EscrowProcessor.name,
          },
        }),
      ]);

      // Notify client
      const displayCurrency = escrow.currency || 'ETB';
      await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_IN_APP, {
        userId: clientId,
        type: 'wallet.unlocked',
        title: this.i18n.t('notifications.escrow.notification.unlockFundsTitle', {
          args: { currency: displayCurrency, amount: amount.toLocaleString() },
          defaultValue: '{currency} {amount} released back to your wallet',
        }),
        body: this.i18n.t('notifications.escrow.notification.unlockFundsBody', {
          defaultValue:
            'Your escrow payment was not completed within 24h. Locked funds have been returned.',
        }),
        metadata: { escrowId, amount, currency: displayCurrency },
      });

      this.logger.log(
        `[unlock-funds] ${displayCurrency} ${amount} unlocked for client ${clientId} from escrow ${escrowId}`,
      );
    } catch (error) {
      this.logger.error(
        `[unlock-funds] Failed for escrow ${escrowId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }
}
