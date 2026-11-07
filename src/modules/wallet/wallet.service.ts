import {
  Injectable,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
  ServiceUnavailableException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { IsInt, IsString, Length, Matches, Max, Min, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { QUEUE_NAMES, WALLET_JOBS } from '../queues/queues.constants';
import { ChapaClient } from '../chapa/chapa.client';

export class WithdrawDto {
  @IsInt()
  @Min(1, { message: 'Minimum withdrawal is ETB 1' })
  @Max(1_000_000, { message: 'Maximum single withdrawal is ETB 1,000,000' })
  amount!: number;

  /** A bank or wallet code from GET /wallet/banks (Chapa's bank id). */
  @IsString()
  @Matches(/^\d{1,6}$/, { message: 'Choose a bank or wallet from the list' })
  bankCode!: string;

  /** The name the account is registered under. */
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100, { message: 'Enter the account holder’s full name' })
  accountName!: string;

  /** Account number, or phone number for a mobile wallet. */
  @Transform(({ value }) => (typeof value === 'string' ? value.replace(/[\s-]/g, '') : value))
  @IsString()
  @Matches(/^\d{6,20}$/, { message: 'The account number must be 6 to 20 digits' })
  accountNumber!: string;

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
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.WALLET) private readonly walletQueue: Queue,
    private readonly chapa: ChapaClient,
  ) {}

  /** Where a freelancer can withdraw to: Chapa's banks and mobile wallets. */
  async payoutBanks() {
    try {
      return await this.chapa.banks();
    } catch (err) {
      this.logger.error(`Could not load Chapa banks: ${(err as Error).message}`);
      throw new ServiceUnavailableException('The bank list is unavailable. Try again shortly.');
    }
  }

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

    if (wallet.availableBalance < amountInWalletCurrency)
      throw new BadRequestException('Insufficient available balance');

    // Check the destination before any money moves: a real Chapa bank, and a number of the
    // length that bank uses.
    const bank = (await this.payoutBanks()).find((b) => b.code === dto.bankCode);
    if (!bank) throw new BadRequestException('Choose a bank or wallet from the list');
    if (bank.accountLength && dto.accountNumber.length !== bank.accountLength) {
      throw new BadRequestException(
        `${bank.name} ${bank.mobileMoney ? 'phone' : 'account'} numbers have ${bank.accountLength} digits`,
      );
    }

    // Debit the wallet and create a pending transaction record atomically.
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
          note: `Withdrawal of ${dto.amount} ${withdrawCurrency} to ${bank.name} — pending`,
        },
      });
      return { tx };
    });

    // Enqueue the payout job — the WalletProcessor handles the actual Chapa
    // transfer with retry logic so this request path returns immediately.
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
          payoutAmount: amountInWalletCurrency,
          payoutCurrency: 'ETB' as const,
          method: bank.name,
          bankCode: bank.code,
          accountName: dto.accountName,
          accountNumber: dto.accountNumber,
        },
        {
          jobId: `wallet-withdrawal-${tx.id}`,
          attempts: 5,
          backoff: { type: 'exponential', delay: 5_000 },
          removeOnComplete: true,
          removeOnFail: false,
        },
      );
    } catch (err) {
      // Queue unavailable — roll back so the user is not left with a decremented
      // balance and no pending payout.
      this.logger.error(
        `Failed to enqueue withdrawal job for tx ${tx.id}: ${(err as Error).message}. Rolling back.`,
      );
      await this.prisma.$transaction([
        this.prisma.freelancerWallet.update({
          where: { userId },
          data: { availableBalance: { increment: amountInWalletCurrency } },
        }),
        this.prisma.walletTransaction.update({
          where: { id: tx.id },
          data: {
            note: `Withdrawal to ${bank.name} — Withdrawal FAILED: queue unavailable`,
          },
        }),
      ]);
      throw new InternalServerErrorException(
        'Could not queue the payout job. Your balance has been restored.',
      );
    }

    return {
      success: true,
      status: 'PENDING',
      amount: dto.amount,
      method: bank.name,
      amountInETB: amountInWalletCurrency,
      note: 'Payout queued — typically processed within 1-2 business days',
    };
  }
}
