import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, WALLET_JOBS } from '../queues/queues.constants';
import { ChapaClient } from '../chapa/chapa.client';

interface ReleasePendingPayload {
  walletId: string;
  userId: string;
  amount: number;
  milestoneId?: string;
}

interface ProcessWithdrawalPayload {
  withdrawalTxId: string;
  userId: string;
  walletId: string;
  requestedAmount: number;
  requestedCurrency: string;
  walletAmount: number;
  payoutAmount: number;
  payoutCurrency: 'ETB';
  method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';
  accountRef: string;
}

type WalletJobPayload = ReleasePendingPayload | ProcessWithdrawalPayload;
type WithdrawalClaim =
  | { status: 'claimed' }
  | { status: 'finalized' }
  | { status: 'processing' }
  | { status: 'missing' };

const WITHDRAWAL_PENDING = 'WITHDRAWAL_PENDING';
const WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING';
const WITHDRAWAL_SUBMITTED = 'WITHDRAWAL_SUBMITTED';
const WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED';
const LEGACY_WITHDRAWAL_PENDING = 'pending Chapa payout';
const LEGACY_WITHDRAWAL_SUBMITTED = 'Chapa transfer submitted';
const LEGACY_WITHDRAWAL_FAILED = 'Withdrawal FAILED';

@Injectable()
@Processor(QUEUE_NAMES.WALLET)
export class WalletProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly chapaClient: ChapaClient,
  ) {
    super();
  }

  async process(job: Job<WalletJobPayload>): Promise<void> {
    if (job.name === WALLET_JOBS.RELEASE_PENDING) {
      await this.releasePending(job as Job<ReleasePendingPayload>);
      return;
    }

    if (job.name === WALLET_JOBS.PROCESS_WITHDRAWAL) {
      await this.processWithdrawal(job as Job<ProcessWithdrawalPayload>);
    }
  }

  private async releasePending(job: Job<ReleasePendingPayload>): Promise<void> {
    const { walletId, userId, amount, milestoneId } = job.data;
    const releaseKey = milestoneId ?? `wallet-release:${job.id ?? `${walletId}:${amount}`}`;

    const released = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "freelancer_wallets" WHERE id = ${walletId} FOR UPDATE`;

      const alreadyReleased = await tx.eventLog.findFirst({
        where: { eventType: 'wallet.pending_released', entityId: releaseKey },
      });
      if (alreadyReleased) {
        return false;
      }

      await tx.freelancerWallet.update({
        where: { id: walletId },
        data: {
          pendingBalance: { decrement: amount },
          availableBalance: { increment: amount },
        },
      });

      await tx.walletTransaction.create({
        data: {
          walletId,
          type: 'CREDIT_AVAILABLE',
          amount,
          note: 'Hold period cleared',
          milestoneId,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'wallet.pending_released',
          entityId: releaseKey,
          entityType: 'FreelancerWallet',
          payload: { walletId, userId, amount, milestoneId, jobId: job.id ?? null },
          processedBy: WalletProcessor.name,
        },
      });

      return true;
    });

    if (!released) {
      this.logger.debug(`[wallet] Pending release ${releaseKey} already processed; skipping`);
      return;
    }

    this.logger.log(`[wallet] Released ETB ${amount} from pending to available for user ${userId}`);
  }

  private async processWithdrawal(job: Job<ProcessWithdrawalPayload>): Promise<void> {
    const {
      withdrawalTxId,
      userId,
      walletAmount,
      payoutAmount,
      payoutCurrency,
      method,
      accountRef,
    } = job.data;

    if (!this.config.get<string>('CHAPA_SECRET_KEY')) {
      const reason = `Chapa secret is not configured for withdrawal ${withdrawalTxId}`;
      this.logger.error(`[wallet] ${reason}`);
      throw new Error(reason);
    }

    const claim = await this.claimWithdrawalForProcessing(withdrawalTxId);
    if (claim.status === 'missing') {
      this.logger.warn(`[wallet] Withdrawal transaction ${withdrawalTxId} was not found`);
      return;
    }

    if (claim.status === 'finalized') {
      this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skipping`);
      return;
    }

    if (claim.status === 'processing') {
      const reconciled = await this.reconcileSubmittedWithdrawal(withdrawalTxId, method);
      if (reconciled) return;

      throw new Error(
        `Withdrawal ${withdrawalTxId} is already being processed; waiting for provider reconciliation`,
      );
    }

    try {
      const result = await this.chapaClient.createTransfer({
        accountName: 'Freelancer',
        accountNumber: accountRef,
        amount: payoutAmount.toString(),
        currency: payoutCurrency,
        reference: withdrawalTxId,
        bankCode: method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513',
      });

      if (result.status !== 'success') {
        const reconciled = await this.reconcileSubmittedWithdrawal(withdrawalTxId, method);
        if (reconciled) return;

        await this.restoreRejectedWithdrawal(
          userId,
          withdrawalTxId,
          walletAmount,
          result.message ?? 'Chapa rejected payout',
        );
        return;
      }

      await this.markWithdrawalSubmitted(
        withdrawalTxId,
        method,
        result.data?.reference ?? withdrawalTxId,
      );

      this.logger.log(
        `[wallet] Submitted withdrawal ${withdrawalTxId} for ETB ${payoutAmount} to Chapa`,
      );
    } catch (err) {
      this.logger.error(
        `[wallet] Chapa transfer failed for withdrawal ${withdrawalTxId}: ${(err as Error).message}`,
      );
      throw err;
    }
  }

  private async claimWithdrawalForProcessing(withdrawalTxId: string): Promise<WithdrawalClaim> {
    return this.prisma.$transaction(
      async (tx: Prisma.TransactionClient): Promise<WithdrawalClaim> => {
        await tx.$queryRaw`SELECT id FROM "wallet_transactions" WHERE id = ${withdrawalTxId} FOR UPDATE`;

        const withdrawal = await tx.walletTransaction.findUnique({
          where: { id: withdrawalTxId },
        });
        if (!withdrawal) {
          return { status: 'missing' };
        }

        const note = withdrawal.note ?? '';
        if (this.isWithdrawalFinalized(note)) {
          return { status: 'finalized' };
        }

        if (note.includes(WITHDRAWAL_PROCESSING)) {
          return { status: 'processing' };
        }

        await tx.walletTransaction.update({
          where: { id: withdrawalTxId },
          data: { note: this.processingNote(note) },
        });

        return { status: 'claimed' };
      },
    );
  }

  private async reconcileSubmittedWithdrawal(
    withdrawalTxId: string,
    method: ProcessWithdrawalPayload['method'],
  ): Promise<boolean> {
    try {
      const verified = await this.chapaClient.verifyTransfer(withdrawalTxId);
      const providerStatus = String(verified.data?.status ?? verified.status ?? '').toLowerCase();
      if (providerStatus !== 'success') {
        return false;
      }

      await this.markWithdrawalSubmitted(
        withdrawalTxId,
        method,
        verified.data?.reference ?? withdrawalTxId,
      );
      return true;
    } catch (err) {
      this.logger.warn(
        `[wallet] Could not verify transfer ${withdrawalTxId} before retry/refund: ${(err as Error).message}`,
      );
      return false;
    }
  }

  private async markWithdrawalSubmitted(
    withdrawalTxId: string,
    method: ProcessWithdrawalPayload['method'],
    reference: string,
  ): Promise<void> {
    await this.prisma.walletTransaction.update({
      where: { id: withdrawalTxId },
      data: {
        note: `${WITHDRAWAL_SUBMITTED} - Withdrawal via ${method} - Chapa transfer submitted (${reference})`,
      },
    });
  }

  private async restoreRejectedWithdrawal(
    userId: string,
    withdrawalTxId: string,
    walletAmount: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "wallet_transactions" WHERE id = ${withdrawalTxId} FOR UPDATE`;

      const withdrawal = await tx.walletTransaction.findUnique({
        where: { id: withdrawalTxId },
      });
      if (!withdrawal || this.isWithdrawalFinalized(withdrawal.note ?? '')) {
        this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skip refund`);
        return;
      }

      const note = withdrawal.note ?? '';
      if (
        !note.includes(WITHDRAWAL_PROCESSING) &&
        !note.includes(WITHDRAWAL_PENDING) &&
        !note.includes(LEGACY_WITHDRAWAL_PENDING)
      ) {
        this.logger.warn(
          `[wallet] Withdrawal ${withdrawalTxId} is not in a refundable state; skip refund`,
        );
        return;
      }

      await tx.walletTransaction.update({
        where: { id: withdrawalTxId },
        data: { note: `${WITHDRAWAL_FAILED} - Withdrawal FAILED: ${reason}` },
      });

      await tx.freelancerWallet.update({
        where: { userId },
        data: { availableBalance: { increment: walletAmount } },
      });
    });
  }

  private processingNote(note: string): string {
    return `${WITHDRAWAL_PROCESSING} - ${note || 'Withdrawal queued for Chapa payout'}`;
  }

  private isWithdrawalFinalized(note: string): boolean {
    return (
      note.includes(WITHDRAWAL_SUBMITTED) ||
      note.includes(WITHDRAWAL_FAILED) ||
      note.includes(LEGACY_WITHDRAWAL_SUBMITTED) ||
      note.includes(LEGACY_WITHDRAWAL_FAILED)
    );
  }
}
