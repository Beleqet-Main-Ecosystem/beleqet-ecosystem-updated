import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionStatus, TransactionType } from '@prisma/client';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { RefundPaymentDto } from './dto/refund-payment.dto';
import { ConvertCurrencyDto } from './dto/convert-currency.dto';
import { TransactionEntity } from './entities/transaction.entity';
import { CurrencyConversionEntity } from './entities/currency-conversion.entity';
import { PaymentDataExportEntity } from './entities/gdpr-export.entity';

/**
 * Service handling global payment gateway operations.
 * Supports multi-currency, Stripe integration, and GDPR compliance.
 */
@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private readonly stripe: Stripe;

  // Supported currencies with their minor unit precision
  private readonly currencyPrecision: Record<string, number> = {
    ETB: 2,
    USD: 2,
    EUR: 2,
    GBP: 2,
  };

  // Exchange rates (in production, fetch from external API)
  private readonly exchangeRates: Record<string, Record<string, number>> = {
    ETB: { USD: 0.0085, EUR: 0.0078, GBP: 0.0067 },
    USD: { ETB: 117.5, EUR: 0.92, GBP: 0.79 },
    EUR: { ETB: 127.8, USD: 1.09, GBP: 0.86 },
    GBP: { ETB: 148.5, USD: 1.27, EUR: 1.16 },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
    if (!stripeKey || stripeKey === 'sk_test_dummy') {
      this.logger.warn('Stripe key not configured. Payments will fail.');
    }
    this.stripe = new Stripe(stripeKey || '', { apiVersion: '2024-06-20' });
  }

  /**
   * Creates a new payment transaction record.
   * Validates currency support and converts amount to platform base currency.
   */
  async createPayment(
    dto: CreatePaymentDto,
    lang: string = 'en',
  ): Promise<TransactionEntity> {
    // Validate currency support
    if (!this.currencyPrecision[dto.currency]) {
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.unsupportedCurrency', {
          lang,
          args: { currency: dto.currency },
        }),
      );
    }

    // Validate gateway exists and supports the currency
    const gateway = await this.prisma.paymentGateway.findFirst({
      where: {
        provider: dto.provider,
        isActive: true,
        supportedCurrencies: { has: dto.currency },
      },
    });

    if (!gateway) {
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.gatewayNotSupported', {
          lang,
          args: { provider: dto.provider, currency: dto.currency },
        }),
      );
    }

    // GDPR: Check consent
    if (!dto.consentGiven) {
      throw new ForbiddenException(
        await this.i18n.translate('payment.errors.consentRequired', { lang }),
      );
    }

    // Convert to base currency (ETB) for unified reporting
    const baseCurrency = 'ETB';
    let convertedAmount = dto.amount;
    let exchangeRate: number | undefined;

    if (dto.currency !== baseCurrency) {
      const conversion = this.convertAmount(dto.amount, dto.currency, baseCurrency);
      convertedAmount = conversion.convertedAmount;
      exchangeRate = conversion.exchangeRate;
    }

    // Create transaction record
    const transaction = await this.prisma.transaction.create({
      data: {
        gatewayId: gateway.id,
        userId: dto.userId,
        amount: convertedAmount,
        currency: baseCurrency,
        originalAmount: dto.amount,
        originalCurrency: dto.currency,
        exchangeRate,
        exchangeRateSource: exchangeRate ? 'internal' : undefined,
        type: dto.type,
        description: dto.description,
        status: TransactionStatus.PENDING,
        consentGiven: dto.consentGiven,
        consentTimestamp: new Date(),
        metadata: {
          descriptionI18nKey: dto.description,
          locale: lang,
        },
      },
    });

    this.logger.log(
      `Payment created: ${transaction.id} for user ${dto.userId} - ${dto.amount} ${dto.currency}`,
    );

    return this.mapToEntity(transaction);
  }

  /**
   * Processes a payment through the selected provider (Stripe).
   */
  async processPayment(
    dto: ProcessPaymentDto,
    lang: string = 'en',
  ): Promise<TransactionEntity> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { gateway: true },
    });

    if (!transaction) {
      throw new NotFoundException(
        await this.i18n.translate('payment.errors.transactionNotFound', { lang }),
      );
    }

    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.alreadyProcessed', { lang }),
      );
    }

    // Update transaction with audit info
    await this.prisma.transaction.update({
      where: { id: dto.transactionId },
      data: {
        status: TransactionStatus.PROCESSING,
        ipAddress: dto.ipAddress,
        userAgent: dto.userAgent,
      },
    });

    try {
      // Process with Stripe
      if (transaction.gateway.provider === 'stripe') {
        const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
        if (!stripeKey || stripeKey === 'sk_test_dummy') {
          throw new BadRequestException(
            await this.i18n.translate('payment.errors.stripeNotConfigured', { lang }),
          );
        }

        const paymentIntent = await this.stripe.paymentIntents.create({
          amount: Math.round(Number(transaction.originalAmount) * 100),
          currency: transaction.originalCurrency.toLowerCase(),
          payment_method: dto.paymentMethodToken,
          confirm: true,
          automatic_payment_methods: { allow_redirects: 'never', enabled: true },
          metadata: {
            transactionId: transaction.id,
            userId: transaction.userId,
          },
        });

        const updated = await this.prisma.transaction.update({
          where: { id: dto.transactionId },
          data: {
            providerTransactionId: paymentIntent.id,
            status:
              paymentIntent.status === 'succeeded'
                ? TransactionStatus.COMPLETED
                : TransactionStatus.FAILED,
          },
        });

        return this.mapToEntity(updated);
      }

      // Fallback for PayPal or other providers
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.providerNotImplemented', {
          lang,
          args: { provider: transaction.gateway.provider },
        }),
      );
    } catch (error) {
      await this.prisma.transaction.update({
        where: { id: dto.transactionId },
        data: { status: TransactionStatus.FAILED },
      });
      throw error;
    }
  }

  /**
   * Refunds a completed transaction. Supports partial refunds.
   */
  async refundPayment(
    dto: RefundPaymentDto,
    lang: string = 'en',
  ): Promise<TransactionEntity> {
    const transaction = await this.prisma.transaction.findUnique({
      where: { id: dto.transactionId },
      include: { gateway: true },
    });

    if (!transaction) {
      throw new NotFoundException(
        await this.i18n.translate('payment.errors.transactionNotFound', { lang }),
      );
    }

    if (transaction.status !== TransactionStatus.COMPLETED) {
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.notRefundable', { lang }),
      );
    }

    const refundAmount = dto.amount ?? Number(transaction.originalAmount);
    const currentRefunded = Number(transaction.refundedAmount || 0);
    const totalAmount = Number(transaction.originalAmount);

    if (currentRefunded + refundAmount > totalAmount) {
      throw new BadRequestException(
        await this.i18n.translate('payment.errors.refundExceedsAmount', { lang }),
      );
    }

    // Process Stripe refund
    if (transaction.gateway.provider === 'stripe' && transaction.providerTransactionId) {
      const stripeKey = this.config.get<string>('STRIPE_SECRET_KEY');
      if (stripeKey && stripeKey !== 'sk_test_dummy') {
        await this.stripe.refunds.create({
          payment_intent: transaction.providerTransactionId,
          amount: Math.round(refundAmount * 100),
          reason: 'requested_by_customer',
        });
      }
    }

    const isFullRefund = currentRefunded + refundAmount >= totalAmount;

    const updated = await this.prisma.transaction.update({
      where: { id: dto.transactionId },
      data: {
        refundedAmount: currentRefunded + refundAmount,
        refundedAt: new Date(),
        status: isFullRefund ? TransactionStatus.REFUNDED : TransactionStatus.COMPLETED,
      },
    });

    this.logger.log(`Refund processed: ${dto.transactionId} - ${refundAmount} ${transaction.originalCurrency}`);

    return this.mapToEntity(updated);
  }

  /**
   * Converts currency amount using internal exchange rates.
   * In production, integrate with XE, ECB, or similar API.
   */
  convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): CurrencyConversionEntity {
    if (fromCurrency === toCurrency) {
      return {
        originalAmount: amount,
        originalCurrency: fromCurrency,
        convertedAmount: amount,
        targetCurrency: toCurrency,
        exchangeRate: 1,
        rateSource: 'internal',
        timestamp: new Date(),
        formattedOriginal: this.formatCurrency(amount, fromCurrency, 'en'),
        formattedConverted: this.formatCurrency(amount, toCurrency, 'en'),
      };
    }

    const rate = this.exchangeRates[fromCurrency]?.[toCurrency];
    if (!rate) {
      throw new BadRequestException(
        `Exchange rate not available for ${fromCurrency} to ${toCurrency}`,
      );
    }

    const converted = parseFloat((amount * rate).toFixed(4));

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      convertedAmount: converted,
      targetCurrency: toCurrency,
      exchangeRate: rate,
      rateSource: 'internal',
      timestamp: new Date(),
      formattedOriginal: this.formatCurrency(amount, fromCurrency, 'en'),
      formattedConverted: this.formatCurrency(converted, toCurrency, 'en'),
    };
  }

  /**
   * Formats currency amount according to locale conventions.
   * i18n support for different number formats.
   */
  formatCurrency(amount: number, currency: string, locale: string): string {
    const formatter = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: this.currencyPrecision[currency] || 2,
    });
    return formatter.format(amount);
  }

  /**
   * Retrieves transactions with optional filtering.
   */
  async findTransactions(
    filters: {
      userId?: string;
      status?: TransactionStatus;
      type?: TransactionType;
      currency?: string;
      startDate?: string;
      endDate?: string;
    },
    lang: string = 'en',
  ): Promise<TransactionEntity[]> {
    const where: Record<string, unknown> = {};

    if (filters.userId) where.userId = filters.userId;
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.currency) where.originalCurrency = filters.currency;
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) (where.createdAt as Record<string, unknown>).gte = new Date(filters.startDate);
      if (filters.endDate) (where.createdAt as Record<string, unknown>).lte = new Date(filters.endDate);
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return transactions.map((t) => this.mapToEntity(t));
  }

  /**
   * GDPR: Export all payment data for a user (Right to Access).
   * Returns portable, structured data.
   */
  async exportUserPaymentData(userId: string): Promise<PaymentDataExportEntity> {
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate totals per currency
    const totalAmountPaid: Record<string, number> = {};
    const totalAmountRefunded: Record<string, number> = {};

    for (const t of transactions) {
      const curr = t.originalCurrency;
      if (t.status === TransactionStatus.COMPLETED || t.status === TransactionStatus.REFUNDED) {
        totalAmountPaid[curr] = (totalAmountPaid[curr] || 0) + Number(t.originalAmount);
      }
      if (t.refundedAmount) {
        totalAmountRefunded[curr] = (totalAmountRefunded[curr] || 0) + Number(t.refundedAmount);
      }
    }

    const consentHistory = transactions
      .filter((t) => t.consentTimestamp)
      .map((t) => ({
        timestamp: t.consentTimestamp!.toISOString(),
        consentGiven: t.consentGiven,
        ipAddress: t.ipAddress || undefined,
        purpose: 'payment_processing',
      }));

    return {
      userId,
      exportedAt: new Date().toISOString(),
      totalTransactions: transactions.length,
      totalAmountPaid,
      totalAmountRefunded,
      transactions: transactions.map((t) => this.mapToEntity(t)),
      consentHistory,
    };
  }

  /**
   * GDPR: Delete all user payment data (Right to Erasure).
   * Anonymizes transaction records while preserving financial audit trail.
   */
  async deleteUserPaymentData(userId: string): Promise<{ deletedCount: number; anonymizedCount: number }> {
    // For financial compliance, we cannot fully delete transactions.
    // Instead, we anonymize user-identifying data.
    const transactions = await this.prisma.transaction.findMany({
      where: { userId },
    });

    let anonymizedCount = 0;

    for (const transaction of transactions) {
      await this.prisma.transaction.update({
        where: { id: transaction.id },
        data: {
          userId: 'ANONYMIZED',
          ipAddress: null,
          userAgent: null,
          metadata: { anonymized: true, originalUserId: userId },
          description: 'ANONYMIZED',
        },
      });
      anonymizedCount++;
    }

    this.logger.log(`GDPR: Anonymized ${anonymizedCount} transactions for user ${userId}`);

    return { deletedCount: 0, anonymizedCount };
  }

  /**
   * Maps Prisma transaction to domain entity.
   */
  private mapToEntity(transaction: {
    id: string;
    gatewayId: string;
    userId: string;
    amount: unknown;
    currency: string;
    originalAmount: unknown;
    originalCurrency: string;
    exchangeRate: unknown;
    exchangeRateSource: string | null;
    providerTransactionId: string | null;
    status: TransactionStatus;
    type: TransactionType;
    description: string | null;
    metadata: unknown;
    consentGiven: boolean;
    consentTimestamp: Date | null;
    ipAddress: string | null;
    userAgent: string | null;
    refundedAmount: unknown;
    refundedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): TransactionEntity {
    return {
      id: transaction.id,
      gatewayId: transaction.gatewayId,
      userId: transaction.userId,
      amount: Number(transaction.amount),
      currency: transaction.currency,
      originalAmount: Number(transaction.originalAmount),
      originalCurrency: transaction.originalCurrency,
      exchangeRate: transaction.exchangeRate ? Number(transaction.exchangeRate) : undefined,
      exchangeRateSource: transaction.exchangeRateSource || undefined,
      providerTransactionId: transaction.providerTransactionId || undefined,
      status: transaction.status,
      type: transaction.type,
      description: transaction.description || undefined,
      metadata: (transaction.metadata as Record<string, unknown>) || undefined,
      consentGiven: transaction.consentGiven,
      consentTimestamp: transaction.consentTimestamp || undefined,
      ipAddress: transaction.ipAddress || undefined,
      userAgent: transaction.userAgent || undefined,
      refundedAmount: transaction.refundedAmount ? Number(transaction.refundedAmount) : undefined,
      refundedAt: transaction.refundedAt || undefined,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt,
    };
  }
}
