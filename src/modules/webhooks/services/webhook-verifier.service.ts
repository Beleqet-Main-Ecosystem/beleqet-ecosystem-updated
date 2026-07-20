/**
 * @fileoverview Webhook signature verification service
 * @module webhooks/services
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  PaymentProvider,
  WebhookVerificationResult,
  WebhookEventType,
  StripeWebhookPayload,
  PayPalWebhookPayload,
  ChapaWebhookPayload,
} from '../types/webhook.types';

/**
 * Service for verifying webhook signatures from payment providers
 * Implements provider-specific verification strategies
 *
 * @class WebhookVerifierService
 * @example
 * const result = await verifier.verifyStripe(rawBody, signature, timestamp);
 */
@Injectable()
export class WebhookVerifierService {
  private readonly logger = new Logger(WebhookVerifierService.name);

  constructor(private configService: ConfigService) {}

  /**
   * Verify Stripe webhook signature using HMAC-SHA256
   * https://stripe.com/docs/webhooks/signatures
   *
   * @param rawBody - Raw request body as Buffer
   * @param signature - X-Stripe-Signature header value
   * @param timestamp - Timestamp from signature header (in seconds)
   * @returns WebhookVerificationResult
   * @throws BadRequestException if signature is invalid
   *
   * @example
   * const result = await verifier.verifyStripe(
   *   buffer,
   *   't=timestamp,v1=signature',
   *   Date.now()
   * );
   */
  async verifyStripe(
    rawBody: Buffer,
    signature: string,
    timestamp: number,
  ): Promise<WebhookVerificationResult> {
    const secret = this.configService.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('Stripe webhook secret not configured');
    }

    // Stripe signature format: t=timestamp,v1=signature
    const parts = signature.split(',');
    const timestampPart = parts.find(p => p.startsWith('t='))?.slice(2);
    const signaturePart = parts.find(p => p.startsWith('v1='))?.slice(3);

    if (!timestampPart || !signaturePart) {
      throw new BadRequestException('Invalid Stripe signature format');
    }

    // Check timestamp freshness (reject if older than 5 minutes)
    const webhookTimestamp = parseInt(timestampPart, 10);
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - webhookTimestamp) > 300) {
      this.logger.warn(`[Stripe] Webhook timestamp too old: ${webhookTimestamp}`);
      throw new BadRequestException('Webhook timestamp outside acceptable window');
    }

    // Verify signature
    const signedContent = `${timestampPart}.${rawBody.toString()}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    // Check length first to avoid timingSafeEqual RangeError
    if (signaturePart.length !== expectedSignature.length) {
      this.logger.warn('[Stripe] Signature verification failed - length mismatch');
      throw new BadRequestException('Stripe signature verification failed');
    }

    if (!crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expectedSignature))) {
      this.logger.warn('[Stripe] Signature verification failed');
      throw new BadRequestException('Stripe signature verification failed');
    }

    this.logger.debug('[Stripe] Signature verified successfully');

    const payload: StripeWebhookPayload = JSON.parse(rawBody.toString());
    return {
      isValid: true,
      provider: PaymentProvider.STRIPE,
      eventType: this.mapStripeEventType(payload.type),
      payload,
      timestamp: new Date(payload.created * 1000),
      idempotencyKey: payload.id,
    };
  }

  /**
   * Verify PayPal webhook signature
   * https://developer.paypal.com/docs/integration/direct/webhooks/
   *
   * @param payload - Webhook payload object
   * @param signature - X-PAYPAL-TRANSMISSION-SIG header value
   * @param transmissionId - X-PAYPAL-TRANSMISSION-ID header value
   * @param transmissionTime - X-PAYPAL-TRANSMISSION-TIME header value
   * @param certUrl - X-PAYPAL-CERT-URL header value
   * @returns WebhookVerificationResult
   * @throws BadRequestException if signature is invalid
   */
  async verifyPayPal(
    payload: Record<string, any>,
    signature: string,
    transmissionId: string,
    transmissionTime: string,
    certUrl: string,
  ): Promise<WebhookVerificationResult> {
    const webhookId = this.configService.get<string>('PAYPAL_WEBHOOK_ID');
    if (!webhookId) {
      throw new BadRequestException('PayPal webhook ID not configured');
    }

    // Construct verification string
    const verificationString = [
      transmissionId,
      transmissionTime,
      webhookId,
      crypto.createHash('sha256').update(JSON.stringify(payload)).digest('hex'),
    ].join('|');

    // In production, verify against PayPal's certificate
    // For now, use simple HMAC verification
    const secret = this.configService.get<string>('PAYPAL_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('PayPal webhook secret not configured');
    }

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(verificationString)
      .digest('base64');

    if (expectedSignature !== signature) {
      this.logger.warn('[PayPal] Signature verification failed');
      throw new BadRequestException('PayPal signature verification failed');
    }

    this.logger.debug('[PayPal] Signature verified successfully');

    const paypalPayload = payload as PayPalWebhookPayload;
    return {
      isValid: true,
      provider: PaymentProvider.PAYPAL,
      eventType: this.mapPayPalEventType(paypalPayload.event_type),
      payload: paypalPayload,
      timestamp: new Date(paypalPayload.create_time),
      idempotencyKey: paypalPayload.id,
    };
  }

  /**
   * Verify Chapa webhook signature using HMAC-SHA256
   * https://dashboard.chapa.co/docs#webhooks
   *
   * @param payload - Webhook payload object
   * @param signature - X-Chapa-Signature header value
   * @returns WebhookVerificationResult
   * @throws BadRequestException if signature is invalid
   */
  async verifyChapa(
    payload: Record<string, any>,
    signature: string,
  ): Promise<WebhookVerificationResult> {
    const secret = this.configService.get<string>('CHAPA_WEBHOOK_SECRET');
    if (!secret) {
      throw new BadRequestException('Chapa webhook secret not configured');
    }

    const payloadString = JSON.stringify(payload);
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex');

    // Check length first to avoid timingSafeEqual RangeError
    if (signature.length !== expectedSignature.length) {
      this.logger.warn('[Chapa] Signature verification failed - length mismatch');
      throw new BadRequestException('Chapa signature verification failed');
    }

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
      this.logger.warn('[Chapa] Signature verification failed');
      throw new BadRequestException('Chapa signature verification failed');
    }

    this.logger.debug('[Chapa] Signature verified successfully');

    const chapaPayload = payload as ChapaWebhookPayload;
    return {
      isValid: true,
      provider: PaymentProvider.CHAPA,
      eventType: this.mapChapaEventType(chapaPayload.event),
      payload: chapaPayload,
      timestamp: new Date(),
      idempotencyKey: chapaPayload.data.reference || chapaPayload.data.tx_ref || '',
    };
  }

  /**
   * Map Stripe event types to normalized event types
   *
   * @private
   */
  private mapStripeEventType(stripeEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'charge.succeeded': WebhookEventType.PAYMENT_SUCCESS,
      'charge.failed': WebhookEventType.PAYMENT_FAILED,
      'charge.refunded': WebhookEventType.PAYMENT_REFUNDED,
      'charge.dispute.created': WebhookEventType.PAYMENT_DISPUTED,
      'customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'customer.subscription.deleted': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'invoice.payment_succeeded': WebhookEventType.INVOICE_PAID,
    };
    return eventMap[stripeEventType] || WebhookEventType.PAYMENT_SUCCESS;
  }

  /**
   * Map PayPal event types to normalized event types
   *
   * @private
   */
  private mapPayPalEventType(paypalEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'PAYMENT.CAPTURE.COMPLETED': WebhookEventType.PAYMENT_SUCCESS,
      'PAYMENT.CAPTURE.DENIED': WebhookEventType.PAYMENT_FAILED,
      'PAYMENT.CAPTURE.REFUNDED': WebhookEventType.PAYMENT_REFUNDED,
      'BILLING.SUBSCRIPTION.CREATED': WebhookEventType.SUBSCRIPTION_CREATED,
      'BILLING.SUBSCRIPTION.CANCELLED': WebhookEventType.SUBSCRIPTION_CANCELLED,
    };
    return eventMap[paypalEventType] || WebhookEventType.PAYMENT_SUCCESS;
  }

  /**
   * Map Chapa event types to normalized event types
   *
   * @private
   */
  private mapChapaEventType(chapaEventType: string): WebhookEventType {
    const eventMap: Record<string, WebhookEventType> = {
      'charge.success': WebhookEventType.PAYMENT_SUCCESS,
      'charge.failed': WebhookEventType.PAYMENT_FAILED,
      'charge.refunded': WebhookEventType.PAYMENT_REFUNDED,
    };
    return eventMap[chapaEventType] || WebhookEventType.PAYMENT_SUCCESS;
  }
}
