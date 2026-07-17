/**
 * @fileoverview Webhook event processing service
 * @module webhooks/services
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WebhookEventType,
  PaymentProvider,
  NormalizedWebhookEvent,
  WebhookVerificationResult,
  PaymentTransactionMetadata,
} from '../types/webhook.types';
import { I18nService } from '../services/i18n.service';
import { GDPRService } from '../services/gdpr.service';

/**
 * Service for processing normalized webhook events
 * Handles business logic, persistence, and event publishing
 *
 * @class WebhookProcessorService
 */
@Injectable()
export class WebhookProcessorService {
  private readonly logger = new Logger(WebhookProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private eventEmitter: EventEmitter2,
    @InjectQueue('webhooks') private webhookQueue: Queue,
    @InjectQueue('notifications') private notificationQueue: Queue,
    @InjectQueue('wallet') private walletQueue: Queue,
    private i18nService: I18nService,
    private gdprService: GDPRService,
  ) {}

  /**
   * Process a verified webhook event
   * Normalizes provider-specific payload and triggers business logic
   *
   * @param verificationResult - Verified webhook data
   * @returns Promise<void>
   *
   * @example
   * await processor.processWebhook(verificationResult);
   */
  async processWebhook(verificationResult: WebhookVerificationResult): Promise<void> {
    const normalizedEvent = this.normalizeEvent(verificationResult);

    this.logger.log(
      `Processing webhook: ${normalizedEvent.provider} - ${normalizedEvent.eventType}`,
    );

    // Store transaction metadata
    await this.storeTransactionMetadata(verificationResult.provider, normalizedEvent);

    // Route to appropriate handler based on event type
    switch (normalizedEvent.eventType) {
      case WebhookEventType.PAYMENT_SUCCESS:
        await this.handlePaymentSuccess(normalizedEvent, verificationResult);
        break;
      case WebhookEventType.PAYMENT_FAILED:
        await this.handlePaymentFailed(normalizedEvent, verificationResult);
        break;
      case WebhookEventType.PAYMENT_REFUNDED:
        await this.handlePaymentRefunded(normalizedEvent, verificationResult);
        break;
      case WebhookEventType.PAYMENT_DISPUTED:
        await this.handlePaymentDisputed(normalizedEvent, verificationResult);
        break;
      case WebhookEventType.SUBSCRIPTION_CREATED:
        await this.handleSubscriptionCreated(normalizedEvent, verificationResult);
        break;
      case WebhookEventType.SUBSCRIPTION_CANCELLED:
        await this.handleSubscriptionCancelled(normalizedEvent, verificationResult);
        break;
      default:
        this.logger.warn(`Unknown event type: ${normalizedEvent.eventType}`);
    }

    // Emit event for other modules to listen
    this.eventEmitter.emit('webhook.processed', normalizedEvent);
  }

  /**
   * Handle successful payment event
   *
   * @private
   */
  private async handlePaymentSuccess(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.debug(
      `[${event.provider}] Processing payment success: ${event.externalTransactionId}`,
    );

    // Find associated wallet or escrow transaction
    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        externalTransactionId: event.externalTransactionId,
      },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found: ${event.externalTransactionId}`);
      return;
    }

    // Update transaction status
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'completed',
        completedAt: event.timestamp,
        metadata: {
          ...transaction.metadata,
          externalProvider: event.provider,
          externalId: event.externalTransactionId,
        },
      },
    });

    // Credit wallet (handle currency conversion)
    const convertedAmount = await this.convertCurrency(
      event.amount,
      event.currency,
      transaction.wallet.currency,
    );

    await this.prisma.freelancerWallet.update({
      where: { id: transaction.walletId },
      data: {
        availableBalance: {
          increment: convertedAmount,
        },
      },
    });

    // Queue notification
    await this.notificationQueue.add(
      'payment-success',
      {
        userId: transaction.wallet.userId,
        amount: convertedAmount,
        currency: transaction.wallet.currency,
        provider: event.provider,
        transactionId: event.externalTransactionId,
      },
      { priority: 1 },
    );

    this.logger.log(
      `Payment success processed: ${event.externalTransactionId} (${convertedAmount} ${transaction.wallet.currency})`,
    );
  }

  /**
   * Handle failed payment event
   *
   * @private
   */
  private async handlePaymentFailed(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.debug(
      `[${event.provider}] Processing payment failed: ${event.externalTransactionId}`,
    );

    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        externalTransactionId: event.externalTransactionId,
      },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found: ${event.externalTransactionId}`);
      return;
    }

    // Update transaction status
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'failed',
        failedAt: event.timestamp,
        metadata: {
          ...transaction.metadata,
          failureReason: event.metadata?.reason || 'Payment declined',
        },
      },
    });

    // Queue notification
    await this.notificationQueue.add(
      'payment-failed',
      {
        userId: transaction.wallet.userId,
        amount: event.amount,
        currency: event.currency,
        provider: event.provider,
        reason: event.metadata?.reason || 'Payment processing failed',
      },
      { priority: 1 },
    );

    this.logger.log(`Payment failed processed: ${event.externalTransactionId}`);
  }

  /**
   * Handle payment refund event
   *
   * @private
   */
  private async handlePaymentRefunded(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.debug(
      `[${event.provider}] Processing payment refund: ${event.externalTransactionId}`,
    );

    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        externalTransactionId: event.externalTransactionId,
      },
      include: {
        wallet: true,
      },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found: ${event.externalTransactionId}`);
      return;
    }

    // Create reverse transaction
    const refundAmount = await this.convertCurrency(
      event.amount,
      event.currency,
      transaction.wallet.currency,
    );

    await this.prisma.walletTransaction.create({
      data: {
        walletId: transaction.walletId,
        type: 'debit',
        amount: refundAmount,
        description: `Refund for transaction ${transaction.id}`,
        status: 'completed',
        externalTransactionId: `REFUND-${event.externalTransactionId}`,
        metadata: {
          originalTransactionId: event.externalTransactionId,
          provider: event.provider,
        },
      },
    });

    // Update original transaction
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'refunded',
        refundedAt: event.timestamp,
      },
    });

    // Queue notification
    await this.notificationQueue.add(
      'payment-refunded',
      {
        userId: transaction.wallet.userId,
        amount: refundAmount,
        currency: transaction.wallet.currency,
        provider: event.provider,
        reason: event.metadata?.reason || 'Refund processed',
      },
      { priority: 1 },
    );

    this.logger.log(`Payment refund processed: ${event.externalTransactionId}`);
  }

  /**
   * Handle payment disputed event
   *
   * @private
   */
  private async handlePaymentDisputed(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.warn(`[${event.provider}] Payment dispute initiated: ${event.externalTransactionId}`);

    const transaction = await this.prisma.walletTransaction.findFirst({
      where: {
        externalTransactionId: event.externalTransactionId,
      },
    });

    if (!transaction) {
      this.logger.warn(`Transaction not found: ${event.externalTransactionId}`);
      return;
    }

    // Create dispute record
    await this.prisma.dispute.create({
      data: {
        reason: `Payment disputed by ${event.provider}`,
        status: 'open',
        amount: event.amount,
        currency: event.currency,
        externalId: event.externalTransactionId,
        provider: event.provider,
        metadata: event.metadata,
      },
    });

    // Queue admin notification
    await this.notificationQueue.add(
      'dispute-alert',
      {
        isAdminAlert: true,
        transactionId: event.externalTransactionId,
        provider: event.provider,
        amount: event.amount,
        currency: event.currency,
      },
      { priority: 2 },
    );

    this.logger.log(`Dispute recorded: ${event.externalTransactionId}`);
  }

  /**
   * Handle subscription created event
   *
   * @private
   */
  private async handleSubscriptionCreated(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.debug(`[${event.provider}] Subscription created: ${event.externalTransactionId}`);

    // Find user by external customer ID
    const user = await this.prisma.user.findFirst({
      where: {
        externalCustomerId: {
          equals: event.externalCustomerId,
        },
      },
    });

    if (!user) {
      this.logger.warn(`User not found for customer: ${event.externalCustomerId}`);
      return;
    }

    // Update user subscription status
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'active',
        subscriptionProvider: event.provider,
        externalSubscriptionId: event.externalTransactionId,
      },
    });

    // Queue welcome notification
    await this.notificationQueue.add(
      'subscription-activated',
      {
        userId: user.id,
        provider: event.provider,
      },
      { priority: 1 },
    );

    this.logger.log(`Subscription activated for user: ${user.id}`);
  }

  /**
   * Handle subscription cancelled event
   *
   * @private
   */
  private async handleSubscriptionCancelled(
    event: NormalizedWebhookEvent,
    verification: WebhookVerificationResult,
  ): Promise<void> {
    this.logger.debug(
      `[${event.provider}] Subscription cancelled: ${event.externalTransactionId}`,
    );

    const user = await this.prisma.user.findFirst({
      where: {
        externalSubscriptionId: event.externalTransactionId,
      },
    });

    if (!user) {
      this.logger.warn(`User not found for subscription: ${event.externalTransactionId}`);
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        subscriptionStatus: 'cancelled',
      },
    });

    // Queue notification
    await this.notificationQueue.add(
      'subscription-cancelled',
      {
        userId: user.id,
        provider: event.provider,
      },
      { priority: 1 },
    );

    this.logger.log(`Subscription cancelled for user: ${user.id}`);
  }

  /**
   * Normalize webhook event to common format
   *
   * @private
   */
  private normalizeEvent(verification: WebhookVerificationResult): NormalizedWebhookEvent {
    const payload = verification.payload;

    switch (verification.provider) {
      case PaymentProvider.STRIPE:
        return this.normalizeStripeEvent(payload);
      case PaymentProvider.PAYPAL:
        return this.normalizePayPalEvent(payload);
      case PaymentProvider.CHAPA:
        return this.normalizeChapaEvent(payload);
      default:
        throw new Error(`Unknown provider: ${verification.provider}`);
    }
  }

  /**
   * Normalize Stripe event
   *
   * @private
   */
  private normalizeStripeEvent(payload: any): NormalizedWebhookEvent {
    const chargeObject = payload.data.object;
    return {
      provider: PaymentProvider.STRIPE,
      eventType: payload.type as WebhookEventType,
      externalTransactionId: chargeObject.id,
      externalCustomerId: chargeObject.customer || '',
      amount: (chargeObject.amount || 0) / 100, // Stripe uses cents
      currency: chargeObject.currency?.toUpperCase() || 'USD',
      status: chargeObject.status || 'pending',
      timestamp: new Date(chargeObject.created * 1000),
      metadata: chargeObject.metadata || {},
    };
  }

  /**
   * Normalize PayPal event
   *
   * @private
   */
  private normalizePayPalEvent(payload: any): NormalizedWebhookEvent {
    const resource = payload.resource;
    return {
      provider: PaymentProvider.PAYPAL,
      eventType: payload.event_type as WebhookEventType,
      externalTransactionId: resource.id,
      externalCustomerId: resource.payer?.email_address || '',
      amount: parseFloat(resource.amount_with_breakdown?.gross_amount?.value || 0),
      currency: resource.amount_with_breakdown?.gross_amount?.currency_code || 'USD',
      status: (resource.status || 'PENDING').toLowerCase(),
      timestamp: new Date(payload.create_time),
      metadata: { supplementary_data: resource.supplementary_data },
    };
  }

  /**
   * Normalize Chapa event
   *
   * @private
   */
  private normalizeChapaEvent(payload: any): NormalizedWebhookEvent {
    const data = payload.data;
    return {
      provider: PaymentProvider.CHAPA,
      eventType: payload.event as WebhookEventType,
      externalTransactionId: data.reference || data.tx_ref || '',
      externalCustomerId: data.email || '',
      amount: data.amount || 0,
      currency: (data.currency || 'ETB').toUpperCase(),
      status: (data.status || 'pending').toLowerCase(),
      timestamp: new Date(),
      metadata: data.customization || {},
    };
  }

  /**
   * Store payment transaction metadata
   *
   * @private
   */
  private async storeTransactionMetadata(
    provider: PaymentProvider,
    event: NormalizedWebhookEvent,
  ): Promise<void> {
    // GDPR compliance: ensure data minimization
    const gdprCompliance = await this.gdprService.getComplianceMetadata(event.externalCustomerId);

    await this.prisma.paymentTransaction.create({
      data: {
        externalTransactionId: event.externalTransactionId,
        externalCustomerId: event.externalCustomerId,
        provider: provider,
        amount: event.amount,
        currency: event.currency,
        status: event.status,
        metadata: {
          ...event.metadata,
          gdprCompliance,
        },
      },
    }).catch(err => {
      if (err.code === 'P2002') {
        // Duplicate key - idempotency check passed
        this.logger.debug(`Duplicate webhook detected: ${event.externalTransactionId}`);
      } else {
        throw err;
      }
    });
  }

  /**
   * Convert currency amount using exchange rates
   * Handles multi-currency support
   *
   * @private
   */
  private async convertCurrency(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
  ): Promise<number> {
    if (fromCurrency === toCurrency) {
      return amount;
    }

    // In production, fetch real-time rates from external service
    const rates = await this.getCurrencyExchangeRate(fromCurrency, toCurrency);
    return amount * rates.rate;
  }

  /**
   * Get currency exchange rate
   *
   * @private
   */
  private async getCurrencyExchangeRate(from: string, to: string): Promise<{ rate: number }> {
    // Placeholder - implement with real exchange rate service
    // e.g., OpenExchangeRates, Fixer.io, etc.
    const staticRates: Record<string, Record<string, number>> = {
      USD: { EUR: 0.92, GBP: 0.79, ETB: 130, NGN: 1550 },
      EUR: { USD: 1.09, GBP: 0.86, ETB: 142, NGN: 1685 },
      ETB: { USD: 0.0077, EUR: 0.0070, GBP: 0.0061, NGN: 11.9 },
      NGN: { USD: 0.00064, EUR: 0.00059, GBP: 0.00051, ETB: 0.084 },
    };

    const rate = staticRates[from]?.[to] || 1;
    return { rate };
  }
}
