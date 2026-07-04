import { Processor, Process } from '@nestjs/bull';
import { Logger, Injectable } from '@nestjs/common';
import { Job as BullJob } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

interface ReleasePendingPayload {
  walletId: string;
  userId: string;
  amount: number;
  milestoneId?: string;
}

/**
 * WalletProcessor — consumes the WALLET queue.
 * Handles any wallet-specific background tasks that are not
 * already covered by EscrowProcessor (e.g. admin-triggered adjustments).
 */
@Injectable()
@Processor(QUEUE_NAMES.WALLET)
export class WalletProcessor {
  private readonly logger = new Logger(WalletProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  @Process('release-pending')
  async handleReleasePending(job: BullJob<ReleasePendingPayload>) {
    const { walletId, userId, amount, milestoneId } = job.data;

    await this.prisma.freelancerWallet.update({
      where: { id: walletId },
      data: {
        pendingBalance:   { decrement: amount },
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

    this.logger.log(`[wallet] Released ETB ${amount} from pending → available for user ${userId}`);
  }
}
