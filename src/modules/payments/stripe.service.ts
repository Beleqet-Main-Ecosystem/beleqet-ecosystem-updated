import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreatePaymentIntentDto,
  StripePaymentMethod,
} from './dto/create-payment-intent.dto';
import { CreateRefundDto } from './dto/webhook.dto';
import {
  StripePaymentIntentResult,
  StripeRefundResult,
  StripeWebhookEvent,
  SupportedCurrency,
  PaymentProvider,
  PaymentStatus,
} from './interfaces/payment.interfaces';

const STRIPE_SUPPORTED_CURRENCIES: SupportedCurrency[] = [
  { code: 'USD', minimumAmount: 50,   zeroDecimal: false },
  { code: 'EUR', minimumAmount: 50,   zeroDecimal: false },
  { code: 'GBP', minimumAmount: 30,   zeroDecimal: false },
  { code: 'ETB', minimumAmount: 100,  zeroDecimal: false },
  { code: 'KES', minimumAmount: 500,  zeroDecimal: false },
  { code: 'NGN', minimumAmount: 5000, zeroDecimal: false },
  { code: 'ZAR', minimumAmount: 500,  zeroDecimal: false },
  { code: 'GHS', minimumAmount: 500,  zeroDecimal: false },
  { code: 'AED', minimumAmount: 200,  zeroDecimal: false },
  { code: 'INR', minimumAmount: 5000, zeroDecimal: false },
  { code: 'CAD', minimumAmount: 50,   zeroDecimal: false },
  { code: 'AUD', minimumAmount: 50,   zeroDecimal: false },
  { code: 'JPY', minimumAmount: 50,   zeroDecimal: true  },
  { code: 'CNY', minimumAmount: 100,  zeroDecimal: false },
  { code: 'CHF', minimumAmount: 50,   zeroDecimal: false },
];

const PII_METADATA_KEYS = ['email', 'phone', 'name', 'address', 'telegramId'];

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secretKey = this.config.getOrThrow<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');

    this.stripe = new Stripe(secretKey, {
      apiVersion: '2024-06-20',
      typescript: true,
      appInfo: {
        name: 'Beleqet Platform',
        version: '1.0.0',
        url: 'https://beleqet.com',
      },
    });
  }

  async createPaymentIntent(dto: CreatePaymentIntentDto): Promise<StripePaymentIntentResult> {
    this.validateCurrency(dto.currency);

    const sanitisedMetadata = this.sanitiseMetadata({
      ...dto.metadata,
      userId: dto.userId,
      beleqet_version: '1.0',
    });

    this.logger.log(`Creating PaymentIntent: amount=${dto.amount} ${dto.currency} userId=${dto.userId}`);

    try {
      const intent = await this.stripe.paymentIntents.create({
        amount:               dto.amount,
        currency:             dto.currency.toLowerCase(),
        payment_method_types: [dto.paymentMethodType ?? StripePaymentMethod.CARD],
        description:          dto.description,
        metadata:             sanitisedMetadata,
      });

      await this.upsertPaymentRecord({
        userId:            dto.userId,
        provider:          'STRIPE',
        providerPaymentId: intent.id,
        amount:            dto.amount,
        currency:          dto.currency.toUpperCase(),
        status:            'PENDING',
        description:       dto.description ?? null,
        metadata:          sanitisedMetadata,
      });

      return {
        id:           intent.id,
        clientSecret: intent.client_secret!,
        status:       intent.status,
        amount:       intent.amount,
        currency:     intent.currency.toUpperCase(),
        createdAt:    new Date(intent.created * 1000).toISOString(),
      };
    } catch (err) {
      this.handleStripeError(err, 'createPaymentIntent');
    }
  }

  async confirmPayment(paymentIntentId: string, paymentMethodId: string): Promise<StripePaymentIntentResult> {
    this.logger.log(`Confirming PaymentIntent: ${paymentIntentId}`);

    try {
      const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
        payment_method: paymentMethodId,
      });

      await this.updatePaymentStatus(intent.id, this.mapStripeStatusToDB(intent.status));

      return {
        id:           intent.id,
        clientSecret: intent.client_secret!,
        status:       intent.status,
        amount:       intent.amount,
        currency:     intent.currency.toUpperCase(),
        createdAt:    new Date(intent.created * 1000).toISOString(),
      };
    } catch (err) {
      this.handleStripeError(err, 'confirmPayment');
    }
  }

  async refund(dto: CreateRefundDto): Promise<StripeRefundResult> {
    this.logger.log(`Issuing refund: paymentIntentId=${dto.paymentIntentId} amount=${dto.amount ?? 'full'}`);

    try {
      const refundParams: Stripe.RefundCreateParams = { payment_intent: dto.paymentIntentId };
      if (dto.amount) refundParams.amount = dto.amount;
      if (dto.reason) refundParams.reason = 'requested_by_customer';

      const refund = await this.stripe.refunds.create(refundParams);

      const newStatus: PaymentStatus = dto.amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
      await this.updatePaymentStatusByProviderPaymentId(dto.paymentIntentId, newStatus);

      return {
        id:              refund.id,
        status:          refund.status ?? 'unknown',
        amount:          refund.amount,
        currency:        (refund.currency ?? 'unknown').toUpperCase(),
        paymentIntentId: dto.paymentIntentId,
        createdAt:       new Date(refund.created * 1000).toISOString(),
      };
    } catch (err) {
      this.handleStripeError(err, 'refund');
    }
  }

  async handleWebhook(rawBody: Buffer, signatureHeader: string): Promise<StripeWebhookEvent> {
    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
    } catch (err) {
      this.logger.warn(`Stripe webhook signature verification failed: ${String(err)}`);
      throw new UnprocessableEntityException('Webhook signature verification failed.');
    }

    this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);
    await this.processWebhookEvent(event);

    return {
      id:       event.id,
      type:     event.type,
      data:     { object: event.data.object as unknown as Record<string, unknown> },
      created:  event.created,
      livemode: event.livemode,
    };
  }

  listSupportedCurrencies(): SupportedCurrency[] {
    return STRIPE_SUPPORTED_CURRENCIES;
  }

  private async processWebhookEvent(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'payment_intent.succeeded': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.updatePaymentStatusByProviderPaymentId(pi.id, 'SUCCEEDED');
        break;
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.updatePaymentStatusByProviderPaymentId(pi.id, 'FAILED');
        break;
      }
      case 'payment_intent.processing': {
        const pi = event.data.object as Stripe.PaymentIntent;
        await this.updatePaymentStatusByProviderPaymentId(pi.id, 'PROCESSING');
        break;
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge;
        const paymentIntentId = typeof charge.payment_intent === 'string'
          ? charge.payment_intent
          : (charge.payment_intent as Stripe.PaymentIntent)?.id;
        if (paymentIntentId) {
          await this.updatePaymentStatusByProviderPaymentId(paymentIntentId, 'REFUNDED');
        }
        break;
      }
      default:
        this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
    }
  }

  private validateCurrency(currency: string): void {
    const supported = STRIPE_SUPPORTED_CURRENCIES.map((c) => c.code);
    if (!supported.includes(currency.toUpperCase())) {
      this.logger.warn(`Currency ${currency} not in local list — forwarding to Stripe for validation.`);
    }
    if (!/^[A-Z]{3}$/.test(currency.toUpperCase())) {
      throw new BadRequestException(`Invalid currency code: ${currency}. Must be ISO 4217 3-letter code.`);
    }
  }

  private sanitiseMetadata(metadata: Record<string, unknown>): Record<string, string> {
    const result: Record<string, string> = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (PII_METADATA_KEYS.includes(key.toLowerCase())) continue;
      result[key] = String(value);
    }
    return result;
  }

  private mapStripeStatusToDB(status: Stripe.PaymentIntent.Status): PaymentStatus {
    const map: Record<Stripe.PaymentIntent.Status, PaymentStatus> = {
      requires_payment_method:  'PENDING',
      requires_confirmation:    'PENDING',
      requires_action:          'PENDING',
      processing:               'PROCESSING',
      requires_capture:         'PROCESSING',
      canceled:                 'CANCELLED',
      succeeded:                'SUCCEEDED',
    };
    return map[status] ?? 'PENDING';
  }

  private async upsertPaymentRecord(data: {
    userId: string;
    provider: PaymentProvider;
    providerPaymentId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string | null;
    metadata: Record<string, string>;
  }): Promise<void> {
    try {
      await this.prisma.payment.upsert({
        where:  { providerPaymentId: data.providerPaymentId },
        update: { status: data.status, updatedAt: new Date() },
        create: {
          userId:            data.userId,
          provider:          data.provider,
          providerPaymentId: data.providerPaymentId,
          amount:            data.amount,
          currency:          data.currency,
          status:            data.status,
          description:       data.description,
          metadata:          data.metadata,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist payment record: ${String(err)}`);
    }
  }

  private async updatePaymentStatusByProviderPaymentId(providerPaymentId: string, status: PaymentStatus): Promise<void> {
    try {
      await this.prisma.payment.updateMany({
        where:  { providerPaymentId },
        data:   { status, updatedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(`Failed to update payment status (${providerPaymentId}): ${String(err)}`);
    }
  }

  private async updatePaymentStatus(providerPaymentId: string, status: PaymentStatus): Promise<void> {
    await this.updatePaymentStatusByProviderPaymentId(providerPaymentId, status);
  }

  private handleStripeError(err: unknown, context: string): never {
    if (err instanceof Stripe.errors.StripeCardError) {
      this.logger.warn(`[${context}] Stripe card error: ${err.message}`);
      throw new UnprocessableEntityException(err.message);
    }
    if (err instanceof Stripe.errors.StripeInvalidRequestError) {
      this.logger.warn(`[${context}] Stripe invalid request: ${err.message}`);
      throw new BadRequestException('Invalid payment request. Check your parameters.');
    }
    if (err instanceof Stripe.errors.StripeError) {
      this.logger.error(`[${context}] Stripe API error: ${err.message}`, err);
      throw new InternalServerErrorException('Payment provider error. Please try again later.');
    }
    this.logger.error(`[${context}] Unexpected error: ${String(err)}`);
    throw new InternalServerErrorException('An unexpected error occurred during payment processing.');
  }
}