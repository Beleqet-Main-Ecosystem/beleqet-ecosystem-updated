/**
 * @fileoverview Webhook endpoints for payment providers
 * @module webhooks/controllers
 */

import {
  Controller,
  Post,
  Body,
  Headers,
  BadRequestException,
  Logger,
  RawBodyRequest,
  Req,
  Get,
  Param,
  UseFilters,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookVerifierService } from '../services/webhook-verifier.service';
import { WebhookRetryService } from '../services/webhook-retry.service';
import { WebhookProcessorService } from '../services/webhook-processor.service';
import { PaymentProvider } from '../types/webhook.types';
import { HttpExceptionFilter } from '../../../common/filters/http-exception.filter';

/**
 * Webhook endpoints for payment gateway integrations
 *
 * Endpoints:
 * - POST /webhooks/stripe
 * - POST /webhooks/paypal
 * - POST /webhooks/chapa
 * - GET /webhooks/status/:jobId
 *
 * @class WebhooksController
 */
@ApiTags('Payment Webhooks')
@Controller('webhooks')
@UseFilters(HttpExceptionFilter)
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private verifierService: WebhookVerifierService,
    private retryService: WebhookRetryService,
    private processorService: WebhookProcessorService,
  ) {}

  /**
   * Stripe webhook endpoint
   * Receives and processes Stripe events
   *
   * @param req - Express request with raw body
   * @param stripeSignature - X-Stripe-Signature header
   * @returns Webhook acceptance confirmation
   *
   * @example
   * POST /api/v1/webhooks/stripe
   * Headers: X-Stripe-Signature: t=1234567890,v1=...
   * Body: {...Stripe event payload...}
   */
  @Post('stripe')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: Object, description: 'Stripe webhook payload' })
  @ApiHeader({
    name: 'X-Stripe-Signature',
    description: 'Stripe signature for verification',
    required: true,
  })
  @ApiResponse({
    status: 202,
    description: 'Webhook accepted for processing',
    schema: { properties: { received: { type: 'boolean' } } },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or payload',
  })
  async handleStripe(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-stripe-signature') stripeSignature: string,
    @Headers('user-agent') _userAgent: string,
  ) {
    const signature = stripeSignature || '';
    const rawBody = req.rawBody;
    const ipAddress = (req.ip || req.socket.remoteAddress || '').toString();

    this.logger.debug(
      `[Stripe] Webhook received - IP: ${ipAddress}, User-Agent: ${_userAgent}`,
    );

    try {
      // Verify signature
      const timestamp = Math.floor(Date.now() / 1000);
      const verification = await this.verifierService.verifyStripe(rawBody, signature, timestamp);

      // Enqueue for processing with retry
      const jobId = await this.retryService.enqueueWebhook(
        verification.provider,
        verification.eventType,
        verification.payload,
        verification.idempotencyKey,
      );

      // Process webhook
      await this.processorService.processWebhook(verification);

      this.logger.log(`[Stripe] Webhook processed: ${verification.idempotencyKey}`);

      return {
        received: true,
        jobId,
        provider: PaymentProvider.STRIPE,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`[Stripe] Webhook processing failed: ${error.message}`);
      throw new BadRequestException(`Stripe webhook error: ${error.message}`);
    }
  }

  /**
   * PayPal webhook endpoint
   * Receives and processes PayPal events
   *
   * @param payload - PayPal webhook payload
   * @param transmissionId - X-PAYPAL-TRANSMISSION-ID header
   * @param transmissionTime - X-PAYPAL-TRANSMISSION-TIME header
   * @param certUrl - X-PAYPAL-CERT-URL header
   * @param signature - X-PAYPAL-TRANSMISSION-SIG header
   * @returns Webhook acceptance confirmation
   *
   * @example
   * POST /api/v1/webhooks/paypal
   * Headers:
   *   X-PAYPAL-TRANSMISSION-ID: ..
   *   X-PAYPAL-TRANSMISSION-TIME: ..
   *   X-PAYPAL-TRANSMISSION-SIG: ..
   *   X-PAYPAL-CERT-URL: ..
   */
  @Post('paypal')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: Object, description: 'PayPal webhook payload' })
  @ApiResponse({
    status: 202,
    description: 'Webhook accepted for processing',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or payload',
  })
  async handlePayPal(
    @Body() payload: Record<string, any>,
    @Headers('x-paypal-transmission-id') transmissionId: string,
    @Headers('x-paypal-transmission-time') transmissionTime: string,
    @Headers('x-paypal-cert-url') certUrl: string,
    @Headers('x-paypal-transmission-sig') signature: string,
    @Headers('user-agent') _userAgent: string,
    @Req() req: Request,
  ) {
    const ipAddress = (req.ip || req.socket.remoteAddress || '').toString();

    this.logger.debug(
      `[PayPal] Webhook received - IP: ${ipAddress}, Transmission ID: ${transmissionId}`,
    );

    try {
      // Verify signature
      const verification = await this.verifierService.verifyPayPal(
        payload,
        signature,
        transmissionId,
        transmissionTime,
        certUrl,
      );

      // Enqueue for processing
      const jobId = await this.retryService.enqueueWebhook(
        verification.provider,
        verification.eventType,
        verification.payload,
        verification.idempotencyKey,
      );

      // Process webhook
      await this.processorService.processWebhook(verification);

      this.logger.log(`[PayPal] Webhook processed: ${verification.idempotencyKey}`);

      return {
        received: true,
        jobId,
        provider: PaymentProvider.PAYPAL,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`[PayPal] Webhook processing failed: ${error.message}`);
      throw new BadRequestException(`PayPal webhook error: ${error.message}`);
    }
  }

  /**
   * Chapa webhook endpoint
   * Receives and processes Chapa (Ethiopian payment) events
   *
   * @param payload - Chapa webhook payload
   * @param signature - X-Chapa-Signature header
   * @returns Webhook acceptance confirmation
   *
   * @example
   * POST /api/v1/webhooks/chapa
   * Headers: X-Chapa-Signature: ...
   * Body: {...Chapa event payload...}
   */
  @Post('chapa')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiBody({ type: Object, description: 'Chapa webhook payload' })
  @ApiHeader({
    name: 'X-Chapa-Signature',
    description: 'Chapa signature for verification',
    required: true,
  })
  @ApiResponse({
    status: 202,
    description: 'Webhook accepted for processing',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid signature or payload',
  })
  async handleChapa(
    @Body() payload: Record<string, any>,
    @Headers('x-chapa-signature') signature: string,
    @Headers('user-agent') _userAgent: string,
    @Req() req: Request,
  ) {
    const ipAddress = (req.ip || req.socket.remoteAddress || '').toString();

    this.logger.debug(
      `[Chapa] Webhook received - IP: ${ipAddress}, Event: ${payload.event}`,
    );

    try {
      // Verify signature
      const verification = await this.verifierService.verifyChapa(payload, signature);

      // Enqueue for processing
      const jobId = await this.retryService.enqueueWebhook(
        verification.provider,
        verification.eventType,
        verification.payload,
        verification.idempotencyKey,
      );

      // Process webhook
      await this.processorService.processWebhook(verification);

      this.logger.log(`[Chapa] Webhook processed: ${verification.idempotencyKey}`);

      return {
        received: true,
        jobId,
        provider: PaymentProvider.CHAPA,
      };
    } catch (err) {
      const error = err as Error;
      this.logger.error(`[Chapa] Webhook processing failed: ${error.message}`);
      throw new BadRequestException(`Chapa webhook error: ${error.message}`);
    }
  }

  /**
   * Check webhook processing status
   *
   * @param jobId - BullMQ job ID
   * @returns Job status and retry information
   *
   * @example
   * GET /api/v1/webhooks/status/abc123
   */
  @Get('status/:jobId')
  @ApiResponse({
    status: 200,
    description: 'Webhook processing status',
    schema: {
      properties: {
        status: { type: 'string', enum: ['pending', 'processing', 'completed', 'failed'] },
        attempt: { type: 'number' },
        nextRetry: { type: 'string', format: 'date-time' },
      },
    },
  })
  async checkStatus(@Param('jobId') jobId: string) {
    this.logger.debug(`Checking webhook status: ${jobId}`);
    return this.retryService.checkStatus(jobId);
  }

  /**
   * Get webhook retry history
   *
   * @param idempotencyKey - Webhook idempotency key
   * @returns Retry history
   *
   * @example
   * GET /api/v1/webhooks/retry-history/payment_123
   */
  @Get('retry-history/:idempotencyKey')
  @ApiResponse({
    status: 200,
    description: 'Webhook retry history',
    isArray: true,
  })
  async getRetryHistory(@Param('idempotencyKey') idempotencyKey: string) {
    this.logger.debug(`Fetching retry history: ${idempotencyKey}`);
    return this.retryService.getRetryHistory(idempotencyKey);
  }
}
