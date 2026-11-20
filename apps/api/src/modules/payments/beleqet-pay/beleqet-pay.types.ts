/**
 * Shared type contracts between the main Beleqet Jobs backend and the
 * Beleqet Pay microservice.  Only the shapes that cross the HTTP boundary
 * are declared here; internal state managed by Beleqet Pay stays opaque.
 */

export interface BeleqetPayCheckoutRequest {
  /** Gross amount in the smallest unit representable as a number (e.g. ETB cents) */
  amount: string;
  currency: string;
  customerEmail: string;
  /** Provider hint — Beleqet Pay picks the best available gateway when omitted */
  preferredProvider?: 'CHAPA' | 'STRIPE' | 'TELEBIRR' | 'ETHSWITCH';
  successRedirectUrl: string;
  /** Opaque reference echoed back in every webhook for the calling service */
  externalRef?: string;
}

export interface BeleqetPayCheckoutResponse {
  txRef: string;
  checkoutUrl: string;
  provider: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
}

export interface BeleqetPayTransaction {
  txRef: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED';
  amount: string;
  currency: string;
  provider: string;
  externalRef?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BeleqetPayEscrowRequest {
  /** ID from the calling service used to correlate the contract */
  counterpartyRef: string;
  amount: string;
  asset: string;
}

export interface BeleqetPayEscrowResponse {
  id: string;
  status: 'AWAITING_DEPOSIT' | 'FUNDED' | 'RELEASED' | 'DISPUTED' | 'REFUNDED';
  counterpartyRef: string;
  amount: string;
  asset: string;
  createdAt: string;
}

/** Normalised webhook payload forwarded from Beleqet Pay to this service */
export interface BeleqetPayWebhookPayload {
  event: 'payment.success' | 'payment.failed' | 'escrow.funded' | 'escrow.released';
  txRef: string;
  externalRef?: string | null;
  status: string;
  amount?: number;
  currency?: string;
  provider?: string;
  [key: string]: unknown;
}
