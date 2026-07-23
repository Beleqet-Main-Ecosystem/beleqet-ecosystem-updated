import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  Logger,
  Optional,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, WALLET_JOBS } from '../queues/queues.constants';

export class WithdrawDto {
  @IsInt()
  @Min(1, { message: 'Minimum withdrawal is ETB 1' })
  @Max(1_000_000, { message: 'Maximum single withdrawal is ETB 1,000,000' })
  amount!: number;

  @IsEnum(['CHAPA', 'TELEBIRR', 'CBE_BIRR'], {
    message: 'method must be CHAPA, TELEBIRR, or CBE_BIRR',
  })
  method!: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';

  @IsString()
  @MaxLength(50, { message: 'accountRef must be 50 characters or fewer' })
  accountRef!: string;

  @IsString()
  @IsOptional()
  currency?: string = 'ETB';
}

@Injectable()
export class WalletService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WalletService.name);
  private fetchInterval?: NodeJS.Timeout;

  // In-memory cache for live rates, fetched from an external API.
  // Initialized with fallback rates in case the API is unreachable initially.
  // EUR is calculated precisely to maintain backward compatibility with tests (120.5 / 130.2).
  private exchangeRates: Record<string, number> = {
    USD: 1,
    EUR: 120.5 / 130.2,
    ETB: 120.5,
  };

  constructor(
    private readonly prisma: PrismaService,
    @Optional()
    @InjectQueue(QUEUE_NAMES.WALLET)
    private readonly walletQueue?: Queue,
  ) {}

  async onModuleInit() {
    if (process.env.NODE_ENV === 'test') {
      return;
    }

    await this.fetchLiveRates();
    // Fetch live rates every 6 hours
    this.fetchInterval = setInterval(() => this.fetchLiveRates(), 6 * 60 * 60 * 1000);
    if (this.fetchInterval.unref) {
      this.fetchInterval.unref();
    }
  }

  onModuleDestroy() {
    if (this.fetchInterval) {
      clearInterval(this.fetchInterval);
    }
  }

  private async fetchLiveRates() {
    try {
      const response = await fetch('https://open.er-api.com/v6/latest/USD');
      if (!response.ok) {
        throw new Error(`Failed to fetch exchange rates: ${response.statusText}`);
      }
      const data = await response.json();
      if (data && data.rates) {
        this.exchangeRates = data.rates;
        this.logger.log('Live exchange rates updated successfully');
      }
    } catch (error) {
      this.logger.error('Error fetching live exchange rates. Falling back to cached rates.', error);
    }
  }

  async getEmployerWallet(userId: string) {
    let wallet = await this.prisma.employerWallet.findUnique({
      where: { userId },
      include: {
        transactions: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!wallet) {
      wallet = await this.prisma.employerWallet.create({
        data: { userId, balance: 0, lockedBalance: 0 },
        include: { transactions: true },
      });
    }
    return wallet;
  }

  async getOrCreate(userId: string) {
    return this.prisma.freelancerWallet.upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: { transactions: { orderBy: { createdAt: 'desc' }, take: 30 } },
    });
  }

  convertCurrency(amount: number, from: string, to: string): number {
    if (from === to) return amount;

    const rateFrom = this.exchangeRates[from];
    const rateTo = this.exchangeRates[to];

    if (!rateFrom || !rateTo) {
      throw new BadRequestException(`Exchange rate for ${from} to ${to} not found`);
    }

    const rate = rateTo / rateFrom;
    return Math.round(amount * rate);
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    const wallet = await this.prisma.freelancerWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    const withdrawCurrency = dto.currency || 'ETB';
    const amountInWalletCurrency = this.convertCurrency(
      dto.amount,
      withdrawCurrency,
      wallet.currency,
    );
    const amountInETB = this.convertCurrency(dto.amount, withdrawCurrency, 'ETB');

    if (wallet.availableBalance < amountInWalletCurrency)
      throw new BadRequestException('Insufficient available balance');

    const { tx } = await this.prisma.$transaction(async (prisma: any) => {
      const updateResult = await prisma.freelancerWallet.updateMany({
        where: {
          userId,
          availableBalance: { gte: amountInWalletCurrency },
        },
        data: { availableBalance: { decrement: amountInWalletCurrency } },
      });
      if (updateResult.count === 0) {
        throw new BadRequestException('Insufficient available balance');
      }

      const tx = await prisma.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type: 'DEBIT_WITHDRAWAL',
          amount: amountInWalletCurrency,
          note: `Withdrawal of ${dto.amount} ${withdrawCurrency} via ${dto.method} - pending Chapa payout of ETB ${amountInETB}`,
        },
      });
      return { tx };
    });

    if (!this.walletQueue) {
      await this.restoreFailedWithdrawal(
        userId,
        tx.id,
        amountInWalletCurrency,
        'withdrawal queue unavailable',
      );
      throw new InternalServerErrorException('Withdrawal queue is unavailable.');
    }

    try {
      await this.walletQueue.add(
        WALLET_JOBS.PROCESS_WITHDRAWAL,
        {
          withdrawalTxId: tx.id,
          userId,
          walletId: wallet.id,
          requestedAmount: dto.amount,
          requestedCurrency: withdrawCurrency,
          walletAmount: amountInWalletCurrency,
          payoutAmount: amountInETB,
          payoutCurrency: 'ETB',
          method: dto.method,
          accountRef: dto.accountRef,
        },
        {
          jobId: `wallet-withdrawal:${tx.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 30_000 },
        },
      );
    } catch (err) {
      this.logger.error(`Failed to enqueue Chapa payout: ${(err as Error).message}. Rolling back.`);
      await this.restoreFailedWithdrawal(
        userId,
        tx.id,
        amountInWalletCurrency,
        'withdrawal queue unavailable',
      );
      throw new InternalServerErrorException(
        'Could not queue payout. Your balance has been restored.',
      );
    }

    return {
      success: true,
      amount: dto.amount,
      amountInETB,
      method: dto.method,
      status: 'PENDING',
      note: 'Payout queued - typically 1-2 business days',
    };
  }

  private async restoreFailedWithdrawal(
    userId: string,
    withdrawalTxId: string,
    amountInWalletCurrency: number,
    reason: string,
  ) {
    await this.prisma.$transaction([
      this.prisma.freelancerWallet.update({
        where: { userId },
        data: { availableBalance: { increment: amountInWalletCurrency } },
      }),
      this.prisma.walletTransaction.update({
        where: { id: withdrawalTxId },
        data: { note: `Withdrawal FAILED: ${reason}` },
      }),
    ]);
  }
}
