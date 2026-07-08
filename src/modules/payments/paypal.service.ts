/**
 * @module PaypalService
 * @description
 * PayPal Checkout integration service for the Beleqet Global Digital Wallet
 * (Task ID: Global-Payments-002).
 *
 * Capabilities:
 *  ✓ createOrder        — create a PayPal Checkout order (one-time)
 *  ✓ captureOrder       — capture an approved PayPal order
 *  ✓ createSubscription — create a recurring PayPal billing agreement
 *  ✓ handleWebhook      — verify PayPal webhook events and update DB
 *
 * GDPR compliance:
 *  - `custom_id` on orders is set to userId (UUID), never raw PII.
 *  - Webhook payloads are logged at debug level only (no PII in info logs).
 *
 * Global Scaling:
 *  - Amount and currency forwarded as-is (ISO 4217 validated by DTO).
 *  - returnUrl / cancelUrl are configurable per-request for i18n frontends.
 */
import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as paypal from 'paypal-rest-sdk';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaypalOrderDto, PaypalOrderIntent } from './dto/create-paypal-order.dto';
import { CapturePaypalOrderDto } from './dto/webhook.dto';
import {
  PaypalOrderResult,
  PaypalCaptureResult,
  PaypalSubscriptionResult,
  PaypalWebhookEvent,
  PaymentStatus,
} from './interfaces/payment.interfaces';

/** PayPal SDK mode type */
type PaypalMode = 'sandbox' | 'live';

@Injectable()
export class PaypalService {
  private readonly logger = new Logger(PaypalService.name);
  private readonly webhookId: string;
  private readonly returnUrlBase: string;
  private readonly cancelUrlBase: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const clientId     = this.config.getOrThrow<string>('PAYPAL_CLIENT_ID');
    const clientSecret = this.config.getOrThrow<string>('PAYPAL_CLIENT_SECRET');
    const mode         = this.config.get<PaypalMode>('PAYPAL_MODE', 'sandbox');

    this.webhookId     = this.config.get<string>('PAYPAL_WEBHOOK_ID', '');
    this.returnUrlBase = this.config.get<string>('PAYPAL_RETURN_URL', 'https://beleqet.com/payment/success');
    this.cancelUrlBase = this.config.get<string>('PAYPAL_CANCEL_URL', 'https://beleqet.com/payment/cancel');

    paypal.configure({
      mode,
      client_id:     clientId,
      client_secret: clientSecret,
    });

    this.logger.log(`PayPal SDK configured in ${mode} mode`);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Create a PayPal Checkout order.
   *
   * Returns an `approvalUrl` that the front-end must redirect the user to
   * for payer approval before the order can be captured.
   *
   * @param dto  Validated CreatePaypalOrderDto.
   */
  async createOrder(dto: CreatePaypalOrderDto): Promise<PaypalOrderResult> {
    // If subscriptionPlanId is provided, delegate to subscription flow
    if (dto.subscriptionPlanId) {
      const sub = await this.createSubscription(dto);
      return {
        id:          sub.id,
        status:      sub.status,
        approvalUrl: sub.approvalUrl,
        amount:      dto.amount.toFixed(2),
        currency:    dto.currency.toUpperCase(),
        createdAt:   sub.createdAt,
      };
    }

    const returnUrl = dto.returnUrl ?? this.returnUrlBase;
    const cancelUrl = dto.cancelUrl ?? this.cancelUrlBase;

    const createPaymentJson: paypal.Payment = {
      intent: (dto.intent ?? PaypalOrderIntent.CAPTURE).toLowerCase() as 'sale' | 'authorize' | 'order',
      payer:  { payment_method: 'paypal' },
      redirect_urls: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
      transactions: [
        {
          amount: {
            total:    dto.amount.toFixed(2),
            currency: dto.currency.toUpperCase(),
          },
          description: dto.description ?? 'Beleqet Platform Payment',
          custom:      dto.userId, // GDPR: UUID only, no raw PII
        },
      ],
    };

    this.logger.log(
      `Creating PayPal order: amount=${dto.amount} ${dto.currency} userId=${dto.userId}`,
    );

    return new Promise((resolve, reject) => {
      paypal.payment.create(createPaymentJson, async (err, payment) => {
        if (err) {
          this.logger.error(`PayPal createOrder failed: ${JSON.stringify(err)}`);
          reject(
            new InternalServerErrorException(
              'PayPal order creation failed. Please try again.',
            ),
          );
          return;
        }

        const approvalLink = (payment.links ?? []).find(
          (l) => l.rel === 'approval_url',
        );

        // Persist to DB
        await this.upsertPaymentRecord({
          userId:            dto.userId,
          provider:          'PAYPAL',
          providerPaymentId: payment.id!,
          amount:            Math.round(dto.amount * 100), // store as cents
          currency:          dto.currency.toUpperCase(),
          status:            'PENDING',
          description:       dto.description ?? null,
        });

        resolve({
          id:          payment.id!,
          status:      payment.state ?? 'created',
          approvalUrl: approvalLink?.href ?? null,
          amount:      dto.amount.toFixed(2),
          currency:    dto.currency.toUpperCase(),
          createdAt:   new Date().toISOString(),
        });
      });
    });
  }

  /**
   * Capture an approved PayPal order (completes the payment).
   *
   * Should be called after the payer returns from the PayPal approval URL
   * with `paymentId` and `PayerID` query parameters.
   *
   * @param dto      CapturePaypalOrderDto containing the orderId.
   * @param payerId  The PayerID returned by PayPal in the redirect URL.
   */
  async captureOrder(
    dto: CapturePaypalOrderDto,
    payerId: string,
  ): Promise<PaypalCaptureResult> {
    if (!payerId) {
      throw new BadRequestException('PayerID is required to capture a PayPal order.');
    }

    this.logger.log(`Capturing PayPal order: ${dto.orderId} payerId=${payerId}`);

    const executePaymentJson = { payer_id: payerId };

    return new Promise((resolve, reject) => {
      paypal.payment.execute(
        dto.orderId,
        executePaymentJson,
        async (err, payment) => {
          if (err) {
            this.logger.error(`PayPal captureOrder failed: ${JSON.stringify(err)}`);
            reject(
              new InternalServerErrorException(
                'PayPal order capture failed. Please try again.',
              ),
            );
            return;
          }

          const captureId =
            payment.transactions?.[0]?.related_resources?.[0]?.sale?.id ?? null;
          const succeeded = payment.state === 'approved';

          await this.updatePaymentStatusByProviderPaymentId(
            dto.orderId,
            succeeded ? 'SUCCEEDED' : 'FAILED',
          );

          resolve({
            orderId:    dto.orderId,
            status:     payment.state ?? 'unknown',
            captureId,
            capturedAt: new Date().toISOString(),
          });
        },
      );
    });
  }

  /**
   * Create a PayPal recurring billing subscription.
   *
   * Uses the PayPal Billing Agreements API to set up recurring payments
   * for subscription plans (e.g. Beleqet Premium monthly).
   *
   * @param dto  CreatePaypalOrderDto with subscriptionPlanId set.
   */
  async createSubscription(dto: CreatePaypalOrderDto): Promise<PaypalSubscriptionResult> {
    if (!dto.subscriptionPlanId) {
      throw new BadRequestException('subscriptionPlanId is required for subscriptions.');
    }

    const returnUrl = dto.returnUrl ?? this.returnUrlBase;
    const cancelUrl = dto.cancelUrl ?? this.cancelUrlBase;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const billingAgreementAttributes: any = {
      name:        dto.description ?? 'Beleqet Subscription',
      description: `Beleqet recurring payment — userId: ${dto.userId}`,
      start_date:  new Date(Date.now() + 60_000).toISOString(), // starts in 1 min
      plan: {
        id: dto.subscriptionPlanId,
      },
      payer: {
        payment_method: 'paypal',
      },
      redirect_urls: {
        return_url: returnUrl,
        cancel_url: cancelUrl,
      },
    };

    this.logger.log(
      `Creating PayPal subscription: planId=${dto.subscriptionPlanId} userId=${dto.userId}`,
    );

    return new Promise((resolve, reject) => {
      paypal.billingAgreement.create(
        billingAgreementAttributes,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async (err: any, billingAgreement: any) => {
          if (err) {
            this.logger.error(`PayPal createSubscription failed: ${JSON.stringify(err)}`);
            reject(
              new InternalServerErrorException(
                'PayPal subscription creation failed. Please try again.',
              ),
            );
            return;
          }

          const approvalLink = (billingAgreement.links ?? []).find(
            (l: { rel: string; href: string }) => l.rel === 'approval_url',
          );

          // Persist subscription payment record
          await this.upsertPaymentRecord({
            userId:            dto.userId,
            provider:          'PAYPAL',
            providerPaymentId: billingAgreement.id!,
            amount:            Math.round(dto.amount * 100),
            currency:          dto.currency.toUpperCase(),
            status:            'PENDING',
            description:       `Subscription: ${dto.subscriptionPlanId}`,
          });

          resolve({
            id:          billingAgreement.id!,
            status:      billingAgreement.state ?? 'Pending',
            approvalUrl: approvalLink?.href ?? null,
            planId:      dto.subscriptionPlanId!,
            createdAt:   new Date().toISOString(),
          });
        },
      );
    });
  }

  /**
   * Process an incoming PayPal webhook event body (already JSON-parsed).
   *
   * PayPal does not use a raw-body HMAC scheme like Stripe — instead it
   * provides header-based verification. For full production hardening, pass
   * the verification headers to the PayPal Webhook Verify API.
   *
   * @param body     Parsed PayPal webhook event object.
   * @param headers  Request headers for verification (transmissionId, etc.).
   */
  async handleWebhook(
    body: PaypalWebhookEvent,
    headers: Record<string, string>,
  ): Promise<PaypalWebhookEvent> {
    this.logger.log(`PayPal webhook received: ${body.event_type} (${body.id})`);
    this.logger.debug(`PayPal webhook headers: ${JSON.stringify(headers)}`);

    // Verify webhook if webhookId is configured
    if (this.webhookId) {
      await this.verifyWebhookSignature(body, headers);
    } else {
      this.logger.warn(
        'PAYPAL_WEBHOOK_ID not set — skipping signature verification (unsafe for production)',
      );
    }

    await this.processWebhookEvent(body);
    return body;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verify the PayPal webhook signature using the PayPal SDK.
   */
  private verifyWebhookSignature(
    body: PaypalWebhookEvent,
    headers: Record<string, string>,
  ): Promise<void> {
    const verifyData = {
      transmission_id:   headers['paypal-transmission-id'] ?? '',
      transmission_time: headers['paypal-transmission-time'] ?? '',
      cert_url:          headers['paypal-cert-url'] ?? '',
      auth_algo:         headers['paypal-auth-algo'] ?? '',
      transmission_sig:  headers['paypal-transmission-sig'] ?? '',
      webhook_id:        this.webhookId,
      webhook_event:     body,
    };

    return new Promise((resolve, reject) => {
      // The @types/paypal-rest-sdk verify signature is (headers, body, id, cb).
      // The actual SDK accepts a single verification-data object as first arg.
      // We cast to any to work around the stale type definition.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (paypal.notification.webhookEvent.verify as any)(
        verifyData,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any, response: any) => {
          if (err) {
            this.logger.error(`PayPal webhook verification error: ${JSON.stringify(err)}`);
            reject(new UnprocessableEntityException('PayPal webhook verification failed.'));
            return;
          }
          if ((response as { verification_status: string }).verification_status !== 'SUCCESS') {
            this.logger.warn('PayPal webhook verification returned non-SUCCESS status');
            reject(new UnprocessableEntityException('PayPal webhook signature invalid.'));
            return;
          }
          resolve();
        },
      );
    });
  }

  /**
   * Dispatch PayPal webhook events to update payment records.
   */
  private async processWebhookEvent(event: PaypalWebhookEvent): Promise<void> {
    const resource = event.resource as Record<string, unknown>;
    const orderId  = (resource['id'] as string | undefined) ?? '';

    switch (event.event_type) {
      case 'PAYMENT.CAPTURE.COMPLETED':
      case 'PAYMENT.SALE.COMPLETED':
        await this.updatePaymentStatusByProviderPaymentId(orderId, 'SUCCEEDED');
        break;

      case 'PAYMENT.CAPTURE.DENIED':
      case 'PAYMENT.SALE.DENIED':
      case 'PAYMENT.SALE.REVERSED':
        await this.updatePaymentStatusByProviderPaymentId(orderId, 'FAILED');
        break;

      case 'PAYMENT.CAPTURE.REFUNDED':
      case 'PAYMENT.SALE.REFUNDED':
        await this.updatePaymentStatusByProviderPaymentId(orderId, 'REFUNDED');
        break;

      case 'BILLING.SUBSCRIPTION.ACTIVATED':
        await this.updatePaymentStatusByProviderPaymentId(orderId, 'SUCCEEDED');
        break;

      case 'BILLING.SUBSCRIPTION.CANCELLED':
      case 'BILLING.SUBSCRIPTION.EXPIRED':
        await this.updatePaymentStatusByProviderPaymentId(orderId, 'CANCELLED');
        break;

      default:
        this.logger.debug(`Unhandled PayPal event: ${event.event_type}`);
    }
  }

  /** Persist a new payment record to the DB. */
  private async upsertPaymentRecord(data: {
    userId: string;
    provider: 'PAYPAL';
    providerPaymentId: string;
    amount: number;
    currency: string;
    status: PaymentStatus;
    description: string | null;
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
        },
      });
    } catch (err) {
      this.logger.error(`Failed to persist PayPal payment record: ${String(err)}`);
    }
  }

  /** Update payment status by providerPaymentId. */
  private async updatePaymentStatusByProviderPaymentId(
    providerPaymentId: string,
    status: PaymentStatus,
  ): Promise<void> {
    try {
      await this.prisma.payment.updateMany({
        where: { providerPaymentId },
        data:  { status, updatedAt: new Date() },
      });
    } catch (err) {
      this.logger.error(
        `Failed to update PayPal payment status (${providerPaymentId}): ${String(err)}`,
      );
    }
  }
}
