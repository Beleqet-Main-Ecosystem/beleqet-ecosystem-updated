import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

@Injectable()
export class PaymentsService {
  private stripe: Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing in environment variables');
    }
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  /**
   * Creates a secure Stripe Payment Intent for multi-currency processing.
   * @param createPaymentIntentDto Payload containing amount, currency, and booking reference
   * @returns Promise resolving to the client secret from Stripe
   */
  async createPaymentIntent(createPaymentIntentDto: CreatePaymentIntentDto): Promise<{ clientSecret: string }> {
    const { amount, currency, bookingId } = createPaymentIntentDto;

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to smallest currency unit (cents)
        currency: currency.toLowerCase(),
        metadata: { bookingId },
        automatic_payment_methods: { enabled: true },
      });

      if (!paymentIntent.client_secret) {
        throw new InternalServerErrorException('Failed to generate payment intent client secret.');
      }

      return { clientSecret: paymentIntent.client_secret };
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown Stripe Error';
      throw new BadRequestException(`Stripe Payment Error: ${errorMessage}`);
    }
  }

  /**
   * Validates and constructs Stripe webhook events cleanly.
   * @param payload Raw buffer from request
   * @param signature Stripe header signature
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is missing');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}