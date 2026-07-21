import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);
  private stripe: Stripe | null = null;

  constructor(private readonly config: ConfigService) {
    const stripeSecret = this.config.get<string>('STRIPE_SECRET_KEY');
    if (stripeSecret) {
      this.stripe = new Stripe(stripeSecret, {
        apiVersion: '2023-10-16' as any,
      });
    }
  }

  /**
   * Initialize a payment link via Chapa
   */
  async initializeChapaTransaction(params: {
    email: string;
    firstName: string;
    lastName: string;
    amount: number; // in cents/smallest unit, but Chapa takes standard decimal (ETB)
    currency: string;
    txRef: string;
    planName: string;
  }): Promise<string> {
    const chapaSecret = this.config.get<string>('CHAPA_SECRET_KEY');
    const amountInDecimal = (params.amount / 100).toFixed(2);

    if (!chapaSecret) {
      this.logger.warn(`CHAPA_SECRET_KEY is not defined. Falling back to mock transaction checkout.`);
      return `${this.config.get('FRONTEND_URL', 'http://localhost:3000')}/payments/mock?tx_ref=${params.txRef}&amount=${amountInDecimal}`;
    }

    try {
      const response = await fetch('https://api.chapa.co/v1/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${chapaSecret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: amountInDecimal,
          currency: params.currency,
          email: params.email,
          first_name: params.firstName,
          last_name: params.lastName,
          tx_ref: params.txRef,
          callback_url: this.config.get<string>('CHAPA_WEBHOOK_URL_SUBSCRIPTION') || `${this.config.get('PORT_URL', 'http://localhost:4000')}/api/v1/subscriptions/webhook/chapa`,
          return_url: this.config.get<string>('CHAPA_RETURN_URL') || `${this.config.get('FRONTEND_URL', 'http://localhost:3000')}/subscriptions/payment-success`,
          customization: {
            title: `Beleqet ${params.planName} Subscription`,
            description: `Payment for Beleqet Subscription Plan`,
          },
        }),
      });

      const data = await response.json();
      if (data.status === 'success' && data.data?.checkout_url) {
        return data.data.checkout_url;
      } else {
        throw new Error(data.message || 'Failed to initialize Chapa transaction');
      }
    } catch (error) {
      this.logger.error(`Chapa initialization failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create a Stripe checkout session for a subscription
   */
  async createStripeCheckoutSession(params: {
    email: string;
    priceId: string;
    successUrl: string;
    cancelUrl: string;
    metadata: Record<string, string>;
  }): Promise<string> {
    if (!this.stripe) {
      this.logger.warn(`Stripe is not configured. Falling back to mock stripe checkout.`);
      return `${this.config.get('FRONTEND_URL', 'http://localhost:3000')}/payments/mock?stripe_session=true&price_id=${params.priceId}&tx_ref=${params.metadata.txRef || 'unknown'}`;
    }

    try {
      // Find or create customer
      const customers = await this.stripe.customers.list({
        email: params.email,
        limit: 1,
      });

      let customerId = customers.data[0]?.id;
      if (!customerId) {
        const customer = await this.stripe.customers.create({
          email: params.email,
        });
        customerId = customer.id;
      }

      const session = await this.stripe.checkout.sessions.create({
        customer: customerId,
        payment_method_types: ['card'],
        line_items: [
          {
            price: params.priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata,
        subscription_data: {
          metadata: params.metadata,
        },
      });

      if (!session.url) {
        throw new Error('Failed to retrieve checkout session URL from Stripe');
      }

      return session.url;
    } catch (error) {
      this.logger.error(`Stripe session creation failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Construct a Stripe event from the webhook request body and verify signature
   */
  verifyStripeWebhook(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.stripe) {
      throw new Error('Stripe client is not initialized');
    }
    const webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not configured');
    }
    return this.stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }
}
