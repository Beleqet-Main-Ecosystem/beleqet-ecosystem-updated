import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job, Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  NOTIFICATION_JOBS,
  QUEUE_NAMES,
  WALLET_JOBS,
} from '../../platform/queues/queues.constants';
import { ChapaClient } from '../chapa/chapa.client';
import { PaymentGateway, PaymentsVia, PayoutOutcome } from '../gateway/payment-gateway.service';

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
  /** The bank's name, for the wallet history. */
  method: string;
  bankCode?: string;
  accountName?: string;
  accountNumber?: string;
  /** Jobs queued before banks were chosen: `method` was TELEBIRR, CBE_BIRR or CHAPA. */
  accountRef?: string;
  /** Who sends it, chosen when it was asked for. Older jobs: Chapa. */
  gateway?: PaymentsVia;
}

/** A Beleqet Pay payout ended; `reference` is the one Jobs gave it. */
interface PayoutResultPayload {
  reference: string;
}

/** The Beleqet Pay payout reference for a withdrawal (one per withdrawal, so resending is safe). */
export const payoutReference = (withdrawalTxId: string) => `wd_${withdrawalTxId}`;

/** Whose withdrawal it is and how much left their wallet, for the message about it. */
const owner = (withdrawal: { amount: number; wallet: { userId: string } }) => ({
  userId: withdrawal.wallet.userId,
  amount: withdrawal.amount,
});

/** Chapa bank ids for withdrawals queued before the bank list existed. */
const LEGACY_BANK_CODES: Record<string, string> = { TELEBIRR: '855', CBE_BIRR: '128' };

type WalletJobPayload = ReleasePendingPayload | ProcessWithdrawalPayload | PayoutResultPayload;
type WithdrawalClaim =
  | { status: 'claimed' }
  | { status: 'finalized' }
  | { status: 'processing' }
  | { status: 'missing' };

const WITHDRAWAL_PENDING = 'WITHDRAWAL_PENDING';
const WITHDRAWAL_PROCESSING = 'WITHDRAWAL_PROCESSING';
const WITHDRAWAL_SUBMITTED = 'WITHDRAWAL_SUBMITTED';
const WITHDRAWAL_FAILED = 'WITHDRAWAL_FAILED';
/** Beleqet Pay confirmed the money reached the bank or wallet (Chapa payouts stop at SUBMITTED). */
const WITHDRAWAL_PAID = 'WITHDRAWAL_PAID';
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
    private readonly gateway: PaymentGateway,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
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
      return;
    }

    if (job.name === WALLET_JOBS.PAYOUT_RESULT) {
      await this.payoutResult(job as Job<PayoutResultPayload>);
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
    const { withdrawalTxId, userId, walletAmount, payoutAmount, payoutCurrency, method } = job.data;
    const bankCode = job.data.bankCode ?? LEGACY_BANK_CODES[method];
    const accountNumber = job.data.accountNumber ?? job.data.accountRef ?? '';
    const accountName = job.data.accountName ?? 'Beleqet freelancer';

    if (job.data.gateway === 'beleqet_pay') {
      await this.payThroughBeleqetPay(job, bankCode, accountNumber, accountName);
      return;
    }

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

    if (!bankCode || !accountNumber) {
      // An old request that never said which bank: give the money back rather than guess.
      await this.restoreRejectedWithdrawal(
        userId,
        withdrawalTxId,
        walletAmount,
        'No bank was chosen. Please withdraw again and pick your bank.',
      );
      return;
    }

    try {
      const result = await this.chapaClient.createTransfer({
        accountName,
        accountNumber,
        amount: payoutAmount.toString(),
        currency: payoutCurrency,
        reference: withdrawalTxId,
        bankCode,
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

  /**
   * Sends a withdrawal through Beleqet Pay. A retry (after a crash, or a Pay outage) sends it again
   * with the same reference, and Pay returns the first transfer instead of paying twice.
   */
  private async payThroughBeleqetPay(
    job: Job<ProcessWithdrawalPayload>,
    bankCode: string | undefined,
    accountNumber: string,
    accountName: string,
  ): Promise<void> {
    const { withdrawalTxId, userId, walletAmount, payoutAmount, method } = job.data;
    const claim = await this.claimWithdrawalForProcessing(withdrawalTxId);
    if (claim.status === 'missing' || claim.status === 'finalized') return;
    if (!bankCode || !accountNumber) {
      await this.restoreRejectedWithdrawal(
        userId,
        withdrawalTxId,
        walletAmount,
        'No bank was chosen. Please withdraw again and pick your bank.',
      );
      return;
    }
    const outcome = await this.gateway.sendPayout({
      reference: payoutReference(withdrawalTxId),
      amount: payoutAmount,
      bankCode,
      accountNumber,
      accountName,
    });
    await this.settleWithdrawal(withdrawalTxId, outcome, method);
    this.logger.log(
      `[wallet] Withdrawal ${withdrawalTxId} for ETB ${payoutAmount} through Beleqet Pay: ${outcome.state}`,
    );
  }

  /** Beleqet Pay said a payout ended: ask Pay how, and settle the withdrawal. */
  private async payoutResult(job: Job<PayoutResultPayload>): Promise<void> {
    const { reference } = job.data;
    if (!reference.startsWith('wd_')) {
      this.logger.warn(`[wallet] Payout ${reference} isn't a withdrawal of ours; ignored`);
      return;
    }
    const outcome = await this.gateway.payoutStatus(reference);
    await this.settleWithdrawal(reference.slice('wd_'.length), outcome);
  }

  /**
   * Records where a Beleqet Pay payout stands: on its way, paid, or failed, which gives the money
   * back to the freelancer's wallet. Once paid or failed, nothing changes it again, so a repeated
   * result never pays back twice.
   */
  private async settleWithdrawal(
    withdrawalTxId: string,
    outcome: PayoutOutcome,
    method?: string,
  ): Promise<void> {
    const settled = await this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.$queryRaw`SELECT id FROM "wallet_transactions" WHERE id = ${withdrawalTxId} FOR UPDATE`;
      const withdrawal = await tx.walletTransaction.findUnique({
        where: { id: withdrawalTxId },
        include: { wallet: { select: { userId: true } } },
      });
      if (!withdrawal) return null;
      const note = withdrawal.note ?? '';
      if (note.includes(WITHDRAWAL_PAID) || note.includes(WITHDRAWAL_FAILED)) return null;

      if (outcome.state === 'pending') {
        if (!note.includes(WITHDRAWAL_SUBMITTED)) {
          await tx.walletTransaction.update({
            where: { id: withdrawalTxId },
            data: {
              note: `${WITHDRAWAL_SUBMITTED} - Withdrawal via ${method ?? outcome.bankName ?? 'your bank'} - sent through Beleqet Pay (${outcome.providerRef})`,
            },
          });
        }
        return null;
      }

      if (outcome.state === 'paid') {
        await tx.walletTransaction.update({
          where: { id: withdrawalTxId },
          data: {
            note: `${WITHDRAWAL_PAID} - Withdrawal via ${method ?? outcome.bankName ?? 'your bank'} - paid through Beleqet Pay (${outcome.providerRef})`,
          },
        });
        return { paid: true, bankName: outcome.bankName, reason: '', ...owner(withdrawal) };
      }

      await tx.walletTransaction.update({
        where: { id: withdrawalTxId },
        data: { note: `${WITHDRAWAL_FAILED} - Withdrawal FAILED: ${outcome.reason}` },
      });
      await tx.freelancerWallet.update({
        where: { id: withdrawal.walletId },
        data: { availableBalance: { increment: withdrawal.amount } },
      });
      return { paid: false, bankName: undefined, reason: outcome.reason, ...owner(withdrawal) };
    });
    if (!settled) return;

    const amount = `ETB ${settled.amount.toLocaleString('en-US')}`;
    await this.notificationsQueue
      .add(
        NOTIFICATION_JOBS.SEND_IN_APP,
        settled.paid
          ? {
              userId: settled.userId,
              type: 'wallet.withdrawal_paid',
              title: `Your withdrawal of ${amount} was paid`,
              body: `It was sent to ${method ?? settled.bankName ?? 'your account'}.`,
              metadata: { withdrawalTxId },
            }
          : {
              userId: settled.userId,
              type: 'wallet.withdrawal_failed',
              title: `Your withdrawal of ${amount} didn't go through`,
              body: `${settled.reason.replace(/[^.!?]$/, '$&.')} The money is back in your wallet, so you can withdraw again.`,
              metadata: { withdrawalTxId },
            },
      )
      .catch((err: Error) =>
        this.logger.warn(
          `[wallet] Could not notify about withdrawal ${withdrawalTxId}: ${err.message}`,
        ),
      );
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
      note.includes(WITHDRAWAL_PAID) ||
      note.includes(WITHDRAWAL_FAILED) ||
      note.includes(LEGACY_WITHDRAWAL_SUBMITTED) ||
      note.includes(LEGACY_WITHDRAWAL_FAILED)
    );
  }
}
