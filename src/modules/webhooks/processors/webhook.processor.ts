/**
 * @fileoverview BullMQ webhook processor
 * @module webhooks/processors
 */

import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { WebhookRetryService } from '../services/webhook-retry.service';
import { WebhookVerifierService } from '../services/webhook-verifier.service';
import { PaymentProvider, WebhookEventType } from '../types/webhook.types';

/**
 * BullMQ processor for webhook queue
 * Handles retries, monitoring, and business logic execution
 *
 * @class WebhookQueueProcessor
 */
@Processor('webhooks')
export class WebhookQueueProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookQueueProcessor.name);

  constructor(
    private processorService: WebhookProcessorService,
    private retryService: WebhookRetryService,
    private verifierService: WebhookVerifierService,
  ) {
    super();
  }

  /**
   * Process webhook jobs from the queue
   *
   * @param job - BullMQ job
   */
  async process(job: Job<any>): Promise<any> {
    const { provider, eventType, payload, idempotencyKey, attempt = 0 } = job.data;

    this.logger.log(
      `[${provider} Processing] Event: ${eventType}, Attempt: ${attempt + 1}, Job: ${job.id}`,
    );

    try {
      // Create verification result from payload
      const verification = {
        isValid: true,
        provider: provider as PaymentProvider,
        eventType: eventType as WebhookEventType,
        payload,
        timestamp: this.getTimestamp(provider, payload),
        idempotencyKey,
      };

      // Process the webhook
      await this.processorService.processWebhook(verification);

      this.logger.log(`[${provider} Processing] Success: ${idempotencyKey}`);
      return { success: true, eventType, idempotencyKey };
    } catch (err) {
      const error = err as Error;
      this.logger.error(
        `[${provider} Processing] Failed (Attempt ${attempt + 1}): ${error.message}`,
      );

      // Log failure and schedule retry
      await this.retryService.markAsFailed(job.id?.toString() || '', error.message, attempt);

      // Rethrow to trigger BullMQ retry mechanism
      throw err;
    }
  }

  /**
   * Get timestamp based on provider payload
   *
   * @private
   */
  private getTimestamp(provider: string, payload: any): Date {
    switch (provider) {
      case PaymentProvider.STRIPE:
        return new Date(payload.created * 1000);
      case PaymentProvider.PAYPAL:
        return new Date(payload.create_time);
      case PaymentProvider.CHAPA:
      default:
        return new Date();
    }
  }
}
