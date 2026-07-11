import { Injectable, NotFoundException, BadRequestException, InternalServerErrorException, Logger } from '@nestjs/common';
import { IsEnum, IsInt, IsString, Max, MaxLength, Min, IsOptional } from 'class-validator';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

export class WithdrawDto {
  @IsInt()
  @Min(1, { message: 'Minimum withdrawal is ETB 1' })
  @Max(1_000_000, { message: 'Maximum single withdrawal is ETB 1,000,000' })
  amount: number;

  @IsEnum(['CHAPA', 'TELEBIRR', 'CBE_BIRR'], { message: 'method must be CHAPA, TELEBIRR, or CBE_BIRR' })
  method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';

  @IsString()
  @MaxLength(50, { message: 'accountRef must be 50 characters or fewer' })
  accountRef: string;

  @IsString()
  @IsOptional()
  currency?: string = 'ETB';
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

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

  // Mock exchange rates. In a real scenario, this would call an external API.
  private readonly exchangeRates: Record<string, number> = {
    'USD_ETB': 120.5,
    'EUR_ETB': 130.2,
    'ETB_USD': 1 / 120.5,
    'ETB_EUR': 1 / 130.2,
  };

  convertCurrency(amount: number, from: string, to: string): number {
    if (from === to) return amount;
    const pair = `${from}_${to}`;
    const rate = this.exchangeRates[pair];
    if (!rate) throw new BadRequestException(`Exchange rate for ${from} to ${to} not found`);
    return Math.round(amount * rate);
  }

  async withdraw(userId: string, dto: WithdrawDto) {
    const wallet = await this.prisma.freelancerWallet.findUnique({ where: { userId } });
    if (!wallet) throw new NotFoundException('Wallet not found');

    // Convert requested withdrawal amount to the wallet's base currency (ETB)
    const withdrawCurrency = dto.currency || 'ETB';
    const amountInWalletCurrency = this.convertCurrency(dto.amount, withdrawCurrency, wallet.currency);

    if (wallet.availableBalance < amountInWalletCurrency) throw new BadRequestException('Insufficient available balance');

    // Step 1: Deduct balance and create a PENDING transaction atomically
    const { tx } = await this.prisma.$transaction(async (prisma: any) => {
      await prisma.freelancerWallet.update({
        where: { userId },
        data: { availableBalance: { decrement: amountInWalletCurrency } },
      });
      const tx = await prisma.walletTransaction.create({
        data: { walletId: wallet.id, type: 'DEBIT_WITHDRAWAL', amount: amountInWalletCurrency, note: `Withdrawal of ${dto.amount} ${withdrawCurrency} via ${dto.method} — pending` },
      });
      return { tx };
    });

    // Step 2: Attempt Chapa payout
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
            account_number: dto.accountRef,
            amount: dto.amount.toString(),
            currency: 'ETB',
            reference: tx.id,
            bank_code: dto.method === 'TELEBIRR' ? '855' : '853d0598-9c01-41ab-ac99-48eab4da1513',
          }),
        });

        const data = await response.json() as { status: string; message?: string };
        if (data.status !== 'success') {
          // Step 3 (rollback): Chapa rejected — restore balance
          this.logger.warn(`Chapa payout rejected: ${data.message}. Rolling back balance for user ${userId}`);
          await this.prisma.$transaction([
            this.prisma.freelancerWallet.update({
              where: { userId },
              data: { availableBalance: { increment: amountInWalletCurrency } },
            }),
            this.prisma.walletTransaction.update({
              where: { id: tx.id },
              data: { note: `Withdrawal via ${dto.method} — FAILED: ${data.message}` },
            }),
          ]);
          throw new InternalServerErrorException(`Payout rejected by payment gateway: ${data.message}`);
        }
      } catch (err) {
        if (err instanceof InternalServerErrorException) throw err;
        // Network error — roll back
        this.logger.error(`Failed to reach Chapa payout: ${(err as Error).message}. Rolling back.`);
        await this.prisma.$transaction([
          this.prisma.freelancerWallet.update({
            where: { userId },
            data: { availableBalance: { increment: amountInWalletCurrency } },
          }),
          this.prisma.walletTransaction.update({
            where: { id: tx.id },
            data: { note: `Withdrawal via ${dto.method} — FAILED: network error` },
          }),
        ]);
        throw new InternalServerErrorException('Could not reach payment gateway. Your balance has been restored.');
      }
    }

    return { success: true, amount: dto.amount, method: dto.method, note: 'Payout processing — typically 1-2 business days' };
  }
}
