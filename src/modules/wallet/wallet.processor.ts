import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
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

    await this.prisma.freelancerWallet.update({
      where: { id: walletId },
      data: {
        pendingBalance: { decrement: amount },
        availableBalance: { increment: amount },
      },
    });

    await this.prisma.walletTransaction.create({
      data: {
        walletId,
        type: 'CREDIT_AVAILABLE',
        amount,
        note: 'Hold period cleared',
        milestoneId,
      },
    });

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

    const withdrawal = await this.prisma.walletTransaction.findUnique({
      where: { id: withdrawalTxId },
    });
    if (!withdrawal) {
      this.logger.warn(`[wallet] Withdrawal transaction ${withdrawalTxId} was not found`);
      return;
    }

    const note = withdrawal.note ?? '';
    if (note.includes('Chapa transfer submitted') || note.includes('Withdrawal FAILED')) {
      this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skipping`);
      return;
    }

    if (!this.config.get<string>('CHAPA_SECRET_KEY')) {
      const reason = `Chapa secret is not configured for withdrawal ${withdrawalTxId}`;
      this.logger.error(`[wallet] ${reason}`);
      throw new Error(reason);
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
        await this.restoreRejectedWithdrawal(
          userId,
          withdrawalTxId,
          walletAmount,
          result.message ?? 'Chapa rejected payout',
        );
        return;
      }

      await this.prisma.walletTransaction.update({
        where: { id: withdrawalTxId },
        data: {
          note: `Withdrawal via ${method} - Chapa transfer submitted (${result.data?.reference ?? withdrawalTxId})`,
        },
      });

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

  private async restoreRejectedWithdrawal(
    userId: string,
    withdrawalTxId: string,
    walletAmount: number,
    reason: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx: any) => {
      const claim = await tx.walletTransaction.updateMany({
        where: {
          id: withdrawalTxId,
          NOT: [
            { note: { contains: 'Chapa transfer submitted' } },
            { note: { contains: 'Withdrawal FAILED' } },
          ],
        },
        data: { note: `Withdrawal FAILED: ${reason}` },
      });

      if (claim.count === 0) {
        this.logger.debug(`[wallet] Withdrawal ${withdrawalTxId} already finalized; skip refund`);
        return;
      }

      await tx.freelancerWallet.update({
        where: { userId },
        data: { availableBalance: { increment: walletAmount } },
      });
    });
  }
}
