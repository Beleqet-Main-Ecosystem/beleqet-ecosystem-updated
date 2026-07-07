/**
 * @file payment.interfaces.ts
 * @description
 * Shared TypeScript interfaces for the Global Payment Gateway module.
 *
 * Covers both Stripe (Global-Payments-001) and PayPal (Global-Payments-002)
 * integrations, plus the Prisma Payment record shape.
 *
 * GDPR note: no raw PII fields here — userId is a UUID reference.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Stripe interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Represents the result returned to the client after creating a
 * Stripe Payment Intent.  Exposes only the minimum information
 * needed for the front-end to complete the payment flow.
 */
export interface StripePaymentIntentResult {
  /** Stripe Payment Intent ID (pi_…) */
  id: string;
  /** Stripe client secret — passed to Stripe.js on the front-end */
  clientSecret: string;
  /** Payment Intent status (requires_payment_method, requires_confirmation…) */
  status: string;
  /** Amount in smallest currency unit */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** ISO timestamp of creation */
  createdAt: string;
}

/**
 * Result shape for a Stripe refund operation.
 */
export interface StripeRefundResult {
  /** Stripe refund ID (re_…) */
  id: string;
  /** 'succeeded' | 'pending' | 'failed' */
  status: string;
  /** Amount refunded in smallest currency unit */
  amount: number;
  /** ISO 4217 currency code */
  currency: string;
  /** Original Payment Intent ID */
  paymentIntentId: string;
  /** ISO timestamp of refund */
  createdAt: string;
}

/**
 * A single entry in the list of currencies supported by Stripe.
 * Used by GET /payments/stripe/currencies.
 */
export interface SupportedCurrency {
  /** ISO 4217 code (e.g. 'ETB', 'USD', 'EUR') */
  code: string;
  /** Minimum charge amount in this currency (Stripe-defined) */
  minimumAmount: number;
  /** Whether this currency supports zero-decimal amounts */
  zeroDecimal: boolean;
}

/**
 * Shape of the decoded Stripe webhook event after signature verification.
 */
export interface StripeWebhookEvent {
  id: string;
  type: string;
  /** Stripe object (PaymentIntent, Charge, Refund…) */
  data: {
    object: Record<string, unknown>;
  };
  created: number;
  livemode: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// PayPal interfaces
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Result returned to the client after creating a PayPal order.
 * Includes the approval URL for redirecting the payer to PayPal.
 */
export interface PaypalOrderResult {
  /** PayPal Order ID (e.g. 5O190127TN364715T) */
  id: string;
  /** 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' */
  status: string;
  /** Redirect URL — payer must approve at this URL */
  approvalUrl: string | null;
  /** Amount as decimal string */
  amount: string;
  /** ISO 4217 currency code */
  currency: string;
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Result after capturing (completing) an approved PayPal order.
 */
export interface PaypalCaptureResult {
  /** PayPal Order ID */
  orderId: string;
  /** 'COMPLETED' | 'PARTIALLY_REFUNDED' | 'PAYER_ACTION_REQUIRED' */
  status: string;
  /** Capture ID — used for refunds */
  captureId: string | null;
  /** ISO timestamp */
  capturedAt: string;
}

/**
 * Result after creating a PayPal subscription (recurring payment).
 */
export interface PaypalSubscriptionResult {
  /** PayPal Subscription ID (I-XXXXXXXXXX) */
  id: string;
  /** 'APPROVAL_PENDING' | 'APPROVED' | 'ACTIVE' | 'SUSPENDED' | 'CANCELLED' */
  status: string;
  /** Approval URL for the payer to activate the subscription */
  approvalUrl: string | null;
  /** Plan ID used */
  planId: string;
  /** ISO timestamp */
  createdAt: string;
}

/**
 * Shape of the incoming PayPal webhook event body after JSON parsing.
 */
export interface PaypalWebhookEvent {
  id: string;
  event_type: string;
  resource_type: string;
  summary: string;
  resource: Record<string, unknown>;
  create_time: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Prisma / DB record interface
// ─────────────────────────────────────────────────────────────────────────────

/** Payment status values stored in the DB. */
export type PaymentStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'REFUNDED'
  | 'PARTIALLY_REFUNDED'
  | 'CANCELLED';

/** Payment provider identifiers. */
export type PaymentProvider = 'STRIPE' | 'PAYPAL';

/**
 * Represents a Payment row as returned by Prisma (mirrors the Prisma schema).
 * Used as the return type for service methods that read from the DB.
 */
export interface PaymentRecord {
  id: string;
  userId: string;
  provider: PaymentProvider;
  providerPaymentId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  description: string | null;
  metadata: Record<string, unknown> | null;
  refundedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}
