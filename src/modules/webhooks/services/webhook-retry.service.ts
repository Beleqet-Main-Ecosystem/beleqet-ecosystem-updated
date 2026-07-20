/**
 * @fileoverview Webhook retry and resilience service
 * @module webhooks/services
 */

import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
import { RetryConfig, PaymentProvider, WebhookEventType } from '../types/webhook.types';

/**
 * Service for managing webhook retry logic and resilience
 * Implements exponential backoff and idempotent retries
 *
 * @class WebhookRetryService
 */
@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);

  private readonly defaultRetryConfig: RetryConfig = {
    maxRetries: 5,
    initialDelayMs: 1000,
    backoffMultiplier: 2,
    maxDelayMs: 300000, // 5 minutes
  };

  constructor(
    private prisma: PrismaService,
    @InjectQueue('webhooks') private webhookQueue: Queue,
  ) {}

  /**
   * Enqueue a webhook for processing with retry configuration
   *
   * @param provider - Payment provider
   * @param eventType - Event type
   * @param payload - Webhook payload
   * @param idempotencyKey - Unique identifier for idempotency
   * @param config - Custom retry configuration
   * @returns Job ID
   */
  async enqueueWebhook(
    provider: PaymentProvider,
    eventType: WebhookEventType,
    payload: Record<string, any>,
    idempotencyKey: string,
    config?: Partial<RetryConfig>,
  ): Promise<string> {
    const retryConfig = { ...this.defaultRetryConfig, ...config };

    // Check if webhook already processed (idempotency)
    const existing = await this.prisma.webhookLog.findUnique({
      where: { idempotencyKey },
    });

    if (existing && existing.processedAt) {
      this.logger.debug(
        `Webhook already processed (idempotent): ${provider} - ${idempotencyKey}`,
      );
      return existing.id;
    }

    // Enqueue with exponential backoff
    const job = await this.webhookQueue.add(
      `webhook-${provider}-${eventType}`,
      {
        provider,
        eventType,
        payload,
        idempotencyKey,
        attempt: 0,
      },
      {
        attempts: retryConfig.maxRetries,
        backoff: {
          type: 'exponential',
          delay: retryConfig.initialDelayMs,
        },
        removeOnComplete: {
          age: 3600, // Keep for 1 hour
        },
        removeOnFail: {
          age: 86400, // Keep failed jobs for 24 hours
        },
      },
    );

    this.logger.log(
      `Webhook enqueued: ${provider} - ${eventType} (Job: ${job.id}, Key: ${idempotencyKey})`,
    );

    return job.id!.toString();
  }

  /**
   * Calculate backoff delay for retry
   *
   * @param attempt - Attempt number (0-based)
   * @param config - Retry configuration
   * @returns Delay in milliseconds
   */
  calculateBackoffDelay(attempt: number, config: RetryConfig = this.defaultRetryConfig): number {
    const delay = config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt);
    return Math.min(delay, config.maxDelayMs);
  }

  /**
   * Mark webhook as successfully processed
   *
   * @param webhookId - Webhook log ID
   * @param responseData - Response from processing
   */
  async markAsProcessed(webhookId: string, responseData?: Record<string, any>): Promise<void> {
    await this.prisma.webhookLog.update({
      where: { id: webhookId },
      data: {
        processedAt: new Date(),
        responseBody: responseData,
        retryCount: 0,
      },
    });

    this.logger.debug(`Webhook marked as processed: ${webhookId}`);
  }

  /**
   * Mark webhook as failed and schedule retry
   *
   * @param webhookId - Webhook log ID
   * @param error - Error message
   * @param retryCount - Current retry count
   */
  async markAsFailed(
    webhookId: string,
    error: string,
    retryCount: number = 0,
  ): Promise<void> {
    const config = this.defaultRetryConfig;
    const nextRetryDelay = this.calculateBackoffDelay(retryCount, config);
    const retryUntil = new Date(Date.now() + nextRetryDelay);

    await this.prisma.webhookLog.update({
      where: { id: webhookId },
      data: {
        error: error,
        retryCount: retryCount + 1,
        retryUntil: retryCount < config.maxRetries ? retryUntil : null,
      },
    });

    if (retryCount < config.maxRetries) {
      this.logger.warn(
        `Webhook failed, scheduling retry: ${webhookId} (Attempt: ${retryCount + 1}/${config.maxRetries}, Retry in: ${nextRetryDelay}ms)`,
      );
    } else {
      this.logger.error(
        `Webhook failed permanently after ${config.maxRetries} attempts: ${webhookId}`,
      );
    }
  }

  /**
   * Process failed webhooks that are ready for retry
   * Should be called periodically (e.g., via cron job)
   */
  async processFailedWebhooks(): Promise<void> {
    const now = new Date();

    // Find webhooks ready for retry
    const failedWebhooks = await this.prisma.webhookLog.findMany({
      where: {
        retryUntil: {
          lte: now,
        },
        processedAt: null,
        retryCount: {
          lt: this.defaultRetryConfig.maxRetries,
        },
      },
      take: 100, // Process in batches
    });

    this.logger.debug(`Found ${failedWebhooks.length} webhooks ready for retry`);

    for (const webhook of failedWebhooks) {
      try {
        await this.webhookQueue.add(
          `webhook-retry-${webhook.provider}`,
          {
            webhookId: webhook.id,
            provider: webhook.provider,
            eventType: webhook.eventType,
            payload: webhook.requestBody,
            idempotencyKey: webhook.idempotencyKey,
            attempt: webhook.retryCount,
          },
          {
            priority: 5, // Lower priority for retries
            delay: 1000,
          },
        );
      } catch (err) {
        this.logger.error(
          `Failed to enqueue retry for webhook ${webhook.id}: ${(err as Error).message}`,
        );
      }
    }
  }

  /**
   * Check webhook processing status
   *
   * @param jobId - BullMQ job ID
   */
  async checkStatus(jobId: string): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed';
    attempt: number;
    nextRetry?: Date;
  }> {
    const job = await this.webhookQueue.getJob(jobId);

    if (!job) {
      return { status: 'completed', attempt: 0 };
    }

    const state = await job.getState();

    return {
      status: (state as any) || 'pending',
      attempt: job.attemptsMade || 0,
      nextRetry: job.processedOn ? new Date(job.processedOn + (job.opts?.delay || 0)) : undefined,
    };
  }

  /**
   * Get webhook retry history
   *
   * @param idempotencyKey - Webhook idempotency key
   */
  async getRetryHistory(idempotencyKey: string) {
    return this.prisma.webhookLog.findMany({
      where: { idempotencyKey },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        statusCode: true,
        error: true,
        retryCount: true,
        retryUntil: true,
        processedAt: true,
        createdAt: true,
      },
    });
  }

  /**
   * Manual retry for specific webhook
   *
   * @param webhookId - Webhook log ID
   */
  async manualRetry(webhookId: string): Promise<string> {
    const webhook = await this.prisma.webhookLog.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      throw new Error(`Webhook not found: ${webhookId}`);
    }

    // Type cast JsonValue to Record<string, any> for enqueueWebhook
    const jobId = await this.enqueueWebhook(
      webhook.provider as PaymentProvider,
      webhook.eventType as WebhookEventType,
      webhook.requestBody as Record<string, any>,
      webhook.idempotencyKey,
    );

    this.logger.log(`Manual retry enqueued for webhook: ${webhookId} (Job: ${jobId})`);

    return jobId;
  }
}
