/**
 * Beleqet Pay's merchant API, as Jobs uses it (see the contract in the Beleqet Pay repo). Amounts
 * are birr as decimal strings ("999.00"); GET answers drop trailing zeros ("999"), so compare them
 * as numbers.
 */

export interface BeleqetPayCheckoutRequest {
  amount: string;
  currency: string;
  customerEmail: string;
  successRedirectUrl: string;
  /** Returned in the payment's webhooks and GET /transactions/:txRef. */
  metadata: Record<string, string>;
}

export interface BeleqetPayCheckoutSession {
  /** Chosen by Pay; always starts with TX-BLQ-. */
  txRef: string;
  checkoutUrl: string;
  provider: string;
  livemode: boolean;
  expiresAt?: string;
}

export type BeleqetPayTransactionStatus =
  'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED' | 'REFUNDED' | 'DISPUTED';

export interface BeleqetPayTransaction {
  txRef: string;
  status: BeleqetPayTransactionStatus;
  amount: string;
  currency: string;
  provider: string;
  livemode: boolean;
  metadata?: Record<string, unknown> | null;
}

/** A bank or wallet Pay can pay out to (Chapa's list); `code` is what transfers take as bankCode. */
export interface BeleqetPayBank {
  code: string;
  name: string;
  mobileMoney: boolean;
  accountLength: number | null;
}

export interface BeleqetPayTransferRequest {
  /** Ours: the same reference always means the same transfer. */
  reference: string;
  amount: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  narration?: string;
}

export interface BeleqetPayTransfer {
  transferRef: string;
  reference: string;
  amount: string;
  currency: string;
  livemode: boolean;
  /** PENDING: on its way (or waiting for Chapa's hours or balance). FAILED: the money is back with us. */
  status: 'PENDING' | 'SUCCEEDED' | 'FAILED';
  submittedAt?: string | null;
  failureReason?: string | null;
  destination?: {
    bankCode?: string;
    bankName?: string;
    accountNumber?: string;
    accountName?: string;
  };
}

/** What Pay posts to /api/v1/beleqet-pay/webhook. `id` is the same on every retry. */
export interface BeleqetPayWebhookEvent {
  id: string;
  event: string;
  /** Unix seconds when this attempt was signed (inside the signed body). */
  timestamp: number;
  createdAt?: string;
  data: {
    txRef?: string;
    reference?: string;
    status?: string;
    metadata?: Record<string, unknown> | null;
    [key: string]: unknown;
  };
}
