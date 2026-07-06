import { Injectable, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Stripe from 'stripe';
import { CreatePaymentIntentDto } from './dto/create-payment-intent.dto';

/**
 * Service handling all interactions with the Stripe API, including PaymentIntent 
 * creation, cross-border multi-currency processing, and secure webhook validation.
 * Adheres strictly to the project's required 2026-06-24.dahlia stable versioning.
 */
@Injectable()
export class PaymentsService {
  private stripe: Stripe.Stripe;

  constructor(private configService: ConfigService) {
    const stripeSecretKey = this.configService.get<string>('STRIPE_SECRET_KEY');
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY is missing in environment variables');
    }
    this.stripe = new Stripe.Stripe(stripeSecretKey, {
      apiVersion: '2026-06-24.dahlia',
    });
  }

  /**
   * Creates a secure Stripe PaymentIntent for multi-currency transactions.
   * Converts the standard base units to their respective lowest denomination (e.g., cents).
   * 
   * @param createPaymentIntentDto Payload containing amount, currency, and local booking reference.
   * @returns {Promise<{ clientSecret: string }>} Resolves to the client secret required by Stripe Elements.
   * @throws {BadRequestException} If the Stripe API encounters an issue or parameters drop.
   * @throws {InternalServerErrorException} If Stripe fails to return a valid client secret string.
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
   * Validates, secures, and constructs verified Stripe webhook events asynchronously.
   * Verifies the cryptographic signature to safeguard against payload tampering.
   * 
   * @param payload Raw binary stream buffer retrieved from the incoming HTTP request.
   * @param signature The unique stripe-signature verification header string.
   * @returns {Stripe.Stripe.Event} A fully typed, structurally validated Stripe Event instance.
   * @throws {Error} If the local webhook configuration mapping is missing.
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Stripe.Event {
    const webhookSecret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is missing');
    }
    return this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
  }
}