import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { PaypalController } from './paypal.controller';
import { PaypalAuthService } from './paypal-auth.service';
import { PaypalOrderService } from './paypal-order.service';
import { PaypalSubscriptionService } from './paypal-subscription.service';
import { PaypalWebhookService } from './paypal-webhook.service';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalProcessor } from './paypal.processor';
import { PaypalI18nService } from './paypal-i18n.service';

/**
 * @module PaypalModule
 * @description PayPal Global Digital Wallet Integration Module.
 *
 * Provides the complete server-side PayPal payment processing stack for the
 * Beleqet freelance marketplace platform. This module handles:
 *
 * - **One-time payments**: Order creation + capture via the PayPal Orders API v2
 * - **Recurring billing**: Subscription lifecycle via the PayPal Subscriptions API v1
 * - **Refunds & disputes**: Partial/full refunds and dispute upsert/sync logic
 * - **Webhooks**: Asymmetric signature verification + async BullMQ dispatch
 * - **i18n**: English/Amharic localisation for notification strings
 * - **GDPR**: PII pseudonymisation before any database persistence
 * - **Mock mode**: Fully offline simulation for demo/interview purposes (`PAYPAL_MODE=mock`)
 *
 * **Required environment variables** (see `.env.example`):
 * - `PAYPAL_CLIENT_ID` — from developer.paypal.com → My Apps & Credentials
 * - `PAYPAL_CLIENT_SECRET` — click "Show" in the PayPal dashboard
 * - `PAYPAL_WEBHOOK_ID` — from PayPal Dashboard → Webhooks
 * - `PAYPAL_MODE` — `'sandbox'` | `'live'` | `'mock'`
 * - `PAYPAL_RETURN_URL` — success redirect URL
 * - `PAYPAL_CANCEL_URL` — cancellation redirect URL
 *
 * **BullMQ Queues registered**:
 * - `paypal` — primary queue for webhook processing, subscription sync, dispute sync
 * - `notifications` — cross-module queue for in-app notifications
 *
 * **Services provided and exported**:
 * - `PaypalAuthService` — OAuth 2.0 token management
 * - `PaypalOrderService` — Orders API lifecycle
 * - `PaypalSubscriptionService` — Subscriptions API lifecycle
 * - `PaypalDisputeService` — Refunds and Disputes management
 * - `PaypalI18nService` — i18n string translations
 *
 * @see {@link PaypalController} for HTTP endpoint documentation
 * @see {@link PaypalProcessor} for BullMQ job handlers
 *
 * @example
 * ```ts
 * // In app.module.ts:
 * @Module({
 *   imports: [PaypalModule],
 * })
 * export class AppModule {}
 * ```
 */
@Module({
  imports: [
    BullModule.registerQueue(
      { name: QUEUE_NAMES.PAYPAL },
      { name: QUEUE_NAMES.NOTIFICATIONS },
    ),
  ],
  providers: [
    PaypalAuthService,
    PaypalOrderService,
    PaypalSubscriptionService,
    PaypalWebhookService,
    PaypalDisputeService,
    PaypalProcessor,
    PaypalI18nService,
  ],
  controllers: [PaypalController],
  exports: [
    PaypalAuthService,
    PaypalOrderService,
    PaypalSubscriptionService,
    PaypalDisputeService,
    PaypalI18nService,
  ],
})
export class PaypalModule {}
