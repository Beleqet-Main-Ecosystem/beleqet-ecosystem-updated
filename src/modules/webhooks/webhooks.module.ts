/**
 * @fileoverview Webhooks module for payment gateway integrations
 * @module webhooks
 */

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { WebhooksController } from './controllers/webhooks.controller';
import { WebhookVerifierService } from './services/webhook-verifier.service';
import { WebhookProcessorService } from './services/webhook-processor.service';
import { WebhookRetryService } from './services/webhook-retry.service';
import { I18nService } from './services/i18n.service';
import { GDPRService } from './services/gdpr.service';
import { WebhookQueueProcessor } from './processors/webhook.processor';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * Webhook module for handling payment provider integrations
 * 
 * Features:
 * - Multi-provider support: Stripe, PayPal, Chapa
 * - Signature verification for each provider
 * - Idempotent webhook processing
 * - Exponential backoff retry mechanism
 * - GDPR compliance and data minimization
 * - Multi-currency and i18n support
 * - Comprehensive logging and monitoring
 * 
 * @example
 * // Import in app.module.ts
 * @Module({
 *   imports: [WebhooksModule],
 * })
 */
@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue(
      { name: 'webhooks' },
      { name: 'notifications' },
      { name: 'wallet' },
    ),
  ],
  controllers: [WebhooksController],
  providers: [
    WebhookVerifierService,
    WebhookProcessorService,
    WebhookRetryService,
    I18nService,
    GDPRService,
    WebhookQueueProcessor,
  ],
  exports: [
    WebhookVerifierService,
    WebhookProcessorService,
    WebhookRetryService,
    I18nService,
    GDPRService,
  ],
})
export class WebhooksModule {}
