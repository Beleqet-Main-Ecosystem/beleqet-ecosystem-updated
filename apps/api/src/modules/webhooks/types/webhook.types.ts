/**
 * @fileoverview Webhook type definitions for payment gateway integrations
 * @module webhooks/types
 */

/**
 * Supported payment providers
 */
export enum PaymentProvider {
  STRIPE = 'stripe',
  PAYPAL = 'paypal',
  CHAPA = 'chapa',
}

/**
 * Webhook event types across all providers
 */
export enum WebhookEventType {
  // Payment successful
  PAYMENT_SUCCESS = 'payment.success',
  // Payment failed
  PAYMENT_FAILED = 'payment.failed',
  // Payment pending/processing
  PAYMENT_PENDING = 'payment.pending',
  // Payment refunded
  PAYMENT_REFUNDED = 'payment.refunded',
  // Payment disputed/chargeback
  PAYMENT_DISPUTED = 'payment.disputed',
  // Subscription created
  SUBSCRIPTION_CREATED = 'subscription.created',
  // Subscription cancelled
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  // Invoice paid
  INVOICE_PAID = 'invoice.paid',
}

/**
 * Webhook verification result
 */
export interface WebhookVerificationResult {
  isValid: boolean;
  provider: PaymentProvider;
  eventType: WebhookEventType;
  payload: Record<string, any>;
  timestamp: Date;
  idempotencyKey: string;
}

/**
 * Payment transaction metadata
 */
export interface PaymentTransactionMetadata {
  provider: PaymentProvider;
  externalTransactionId: string;
  externalCustomerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Webhook log entry for monitoring
 */
export interface WebhookLogEntry {
  id: string;
  provider: PaymentProvider;
  eventType: WebhookEventType;
  externalId: string;
  statusCode: number;
  isVerified: boolean;
  ipAddress: string;
  userAgent: string;
  requestBody: Record<string, any>;
  responseBody: Record<string, any>;
  error?: string;
  retryCount: number;
  retryUntil?: Date;
  processedAt?: Date;
  createdAt: Date;
}

/**
 * Stripe webhook event payload
 */
export interface StripeWebhookPayload {
  id: string;
  object: string;
  type: string;
  created: number;
  data: {
    object: Record<string, any>;
    previous_attributes?: Record<string, any>;
  };
  livemode: boolean;
}

/**
 * PayPal webhook event payload
 */
export interface PayPalWebhookPayload {
  id: string;
  event_version: string;
  create_time: string;
  event_type: string;
  resource_type: string;
  resource: Record<string, any>;
  links?: Array<{ rel: string; href: string }>;
}

/**
 * Chapa webhook event payload
 */
export interface ChapaWebhookPayload {
  event: string;
  data: {
    first_name?: string;
    last_name?: string;
    email?: string;
    currency?: string;
    amount?: number;
    charge?: number;
    status?: string;
    reference?: string;
    tx_ref?: string;
    customization?: Record<string, any>;
    meta?: Record<string, any>;
  };
}

/**
 * Normalized webhook event
 */
export interface NormalizedWebhookEvent {
  provider: PaymentProvider;
  eventType: WebhookEventType;
  externalTransactionId: string;
  externalCustomerId: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  timestamp: Date;
  metadata?: Record<string, any>;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  maxDelayMs: number;
}

/**
 * GDPR compliance metadata
 */
export interface GDPRMetadata {
  dataProcessingAgreement: boolean;
  consentObtained: boolean;
  purposeLimitation: 'payment' | 'marketing' | 'analytics';
  retentionDays: number;
  isPersonalData: boolean;
}

/**
 * I18n and localization context
 */
export interface LocalizationContext {
  locale: string;
  timezone: string;
  currency: string;
  currencySymbol: string;
}
