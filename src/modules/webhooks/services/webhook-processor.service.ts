/**
 * @fileoverview Webhook event processing service
 * @module webhooks/services
 */

import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../prisma/prisma.service';
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
        metadata: {
          ...(transaction.metadata as any || {}),
          externalProvider: event.provider,
          externalId: event.externalTransactionId,
          completedAt: event.timestamp.toISOString(),
        } as any,
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
        metadata: {
          ...(transaction.metadata as any || {}),
          failedAt: event.timestamp.toISOString(),
          failureReason: event.metadata?.reason || 'Payment declined',
        } as any,
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
        type: 'DEBIT_WITHDRAWAL',
        amount: refundAmount,
        note: `Refund for transaction ${transaction.id}`,
        externalTransactionId: `REFUND-${event.externalTransactionId}`,
        status: 'completed',
        metadata: {
          originalTransactionId: event.externalTransactionId,
          provider: event.provider,
        } as any,
      },
    });

    // Update original transaction
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'refunded',
        metadata: {
          ...(transaction.metadata as any || {}),
          refundedAt: event.timestamp.toISOString(),
        } as any,
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

    // Update transaction with dispute information
    await this.prisma.walletTransaction.update({
      where: { id: transaction.id },
      data: {
        status: 'disputed',
        metadata: {
          ...(transaction.metadata as any || {}),
          disputedAt: event.timestamp.toISOString(),
          disputeReason: event.metadata?.reason || 'Payment disputed',
          disputeProvider: event.provider,
          disputeAmount: event.amount,
          disputeCurrency: event.currency,
        } as any,
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

    // Locate user by external customer identifier
    const foundUser = await this.prisma.user.findFirst({
      where: {
        externalCustomerId: {
          equals: event.externalCustomerId,
        },
      },
    });

    if (!foundUser) {
      this.logger.warn(`User not found for customer: ${event.externalCustomerId}`);
      return;
    }

    // Activate user subscription
    const userUpdateFields = {
      subscriptionStatus: 'active',
      externalSubscriptionId: event.externalTransactionId,
    };
    
    await this.prisma.user.update({
      where: { id: foundUser.id },
      data: userUpdateFields,
    });

    // Send notification
    await this.notificationQueue.add(
      'subscription-activated',
      {
        userId: foundUser.id,
        provider: event.provider,
      },
      { priority: 1 },
    );

    this.logger.log(`Subscription activated for user: ${foundUser.id}`);
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
    
    // Map Stripe event types to normalized event types
    const eventTypeMap: Record<string, WebhookEventType> = {
      'charge.succeeded': WebhookEventType.PAYMENT_SUCCESS,
      'charge.failed': WebhookEventType.PAYMENT_FAILED,
      'charge.pending': WebhookEventType.PAYMENT_PENDING,
      'charge.refunded': WebhookEventType.PAYMENT_REFUNDED,
      'charge.dispute.created': WebhookEventType.PAYMENT_DISPUTED,
      'customer.subscription.created': WebhookEventType.SUBSCRIPTION_CREATED,
      'customer.subscription.deleted': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'invoice.paid': WebhookEventType.INVOICE_PAID,
    };
    
    return {
      provider: PaymentProvider.STRIPE,
      eventType: eventTypeMap[payload.type] || payload.type as WebhookEventType,
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
    
    // Map PayPal event types to normalized event types
    const eventTypeMap: Record<string, WebhookEventType> = {
      'PAYMENT.CAPTURE.COMPLETED': WebhookEventType.PAYMENT_SUCCESS,
      'PAYMENT.CAPTURE.DENIED': WebhookEventType.PAYMENT_FAILED,
      'PAYMENT.CAPTURE.PENDING': WebhookEventType.PAYMENT_PENDING,
      'PAYMENT.CAPTURE.REFUNDED': WebhookEventType.PAYMENT_REFUNDED,
      'CUSTOMER.DISPUTE.CREATED': WebhookEventType.PAYMENT_DISPUTED,
      'BILLING.SUBSCRIPTION.CREATED': WebhookEventType.SUBSCRIPTION_CREATED,
      'BILLING.SUBSCRIPTION.CANCELLED': WebhookEventType.SUBSCRIPTION_CANCELLED,
      'INVOICING.INVOICE.PAID': WebhookEventType.INVOICE_PAID,
    };
    
    return {
      provider: PaymentProvider.PAYPAL,
      eventType: eventTypeMap[payload.event_type] || payload.event_type as WebhookEventType,
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
    
    // Map Chapa event types to normalized event types
    const eventTypeMap: Record<string, WebhookEventType> = {
      'charge.success': WebhookEventType.PAYMENT_SUCCESS,
      'charge.failed': WebhookEventType.PAYMENT_FAILED,
      'charge.pending': WebhookEventType.PAYMENT_PENDING,
      'charge.refund': WebhookEventType.PAYMENT_REFUNDED,
      'charge.dispute': WebhookEventType.PAYMENT_DISPUTED,
    };
    
    return {
      provider: PaymentProvider.CHAPA,
      eventType: eventTypeMap[payload.event] || payload.event as WebhookEventType,
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
        metadata: JSON.parse(JSON.stringify({
          ...event.metadata,
          gdprCompliance,
        })),
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
