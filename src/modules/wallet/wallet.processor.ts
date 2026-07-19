import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

interface ReleasePendingPayload {
  walletId: string;
  userId: string;
  amount: number;
  milestoneId?: string;
}

@Injectable()
@Processor(QUEUE_NAMES.WALLET)
export class WalletProcessor extends WorkerHost {
  private readonly logger = new Logger(WalletProcessor.name);

  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async process(job: Job<ReleasePendingPayload>): Promise<void> {
    if (job.name === 'release-pending') {
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
}