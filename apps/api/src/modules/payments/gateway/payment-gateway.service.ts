import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaBank } from '../chapa/chapa.types';
import {
  BeleqetPayError,
  BeleqetPayService,
  isBeleqetPayRef,
} from '../beleqet-pay/beleqet-pay.service';
import { BeleqetPayTransfer } from '../beleqet-pay/beleqet-pay.types';

/** Who takes Jobs' online payments and sends its payouts: Chapa directly, or Beleqet Pay. */
export type PaymentsVia = 'chapa' | 'beleqet_pay';

export type CheckoutRequest = {
  /** Birr, e.g. "999.00". */
  amount: string;
  currency: string;
  email: string;
  firstName: string;
  lastName: string;
  returnUrl: string;
  /** Shown on Chapa's page. */
  title: string;
  description: string;
  /** Ours, for this attempt: Chapa's tx_ref, or Pay's Idempotency-Key. */
  reference: string;
  /** Which Jobs record this pays for; Pay returns it with the payment and in its webhooks. */
  metadata: Record<string, string>;
};

/** A payment as its provider reports it. `amount` is birr (NaN when not given). */
export type PaymentCheck = {
  state: 'success' | 'pending' | 'failed';
  amount: number;
  currency: string;
  /** Pay only: the metadata sent with the checkout. */
  metadata?: Record<string, unknown> | null;
  raw: unknown;
};

export type PayoutRequest = {
  reference: string;
  /** Birr. */
  amount: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
};

/**
 * pending: Pay has it and sends it (it may wait for Chapa's transfer hours or balance).
 * paid: delivered. failed: not delivered, and no money left: give it back to the freelancer.
 */
export type PayoutOutcome =
  | {
      state: 'pending';
      providerRef: string;
      bankName?: string;
      /** Pay has handed it to Chapa. If not, it waits for Pay's Chapa balance until `sendBy`. */
      sent: boolean;
      sendBy?: string | null;
    }
  | { state: 'paid'; providerRef: string; bankName?: string }
  | { state: 'failed'; providerRef?: string; reason: string };

/**
 * One place that knows where payments go. New checkouts, the bank list and payouts follow
 * PAYMENTS_VIA (`chapa`, the default, or `beleqet_pay`); a payment that already exists is always
 * checked with the provider that made it (Pay's references start with TX-BLQ-), so switching
 * never strands one.
 */
@Injectable()
export class PaymentGateway implements OnModuleInit {
  private readonly logger = new Logger(PaymentGateway.name);

  constructor(
    private readonly config: ConfigService,
    private readonly chapa: ChapaClient,
    private readonly pay: BeleqetPayService,
  ) {}

  onModuleInit() {
    if (this.current() === 'beleqet_pay' && !this.pay.isConfigured()) {
      this.logger.error(
        'PAYMENTS_VIA=beleqet_pay but BELEQET_PAY_SERVICE_KEY is empty: online payments will fail',
      );
    }
  }

  current(): PaymentsVia {
    const via = (this.config.get<string>('PAYMENTS_VIA') ?? '').trim().toLowerCase();
    return via === 'beleqet_pay' ? 'beleqet_pay' : 'chapa';
  }

  /** Opens a hosted payment page; `providerRef` is what to store to find the payment again. */
  async openCheckout(
    request: CheckoutRequest,
  ): Promise<{ checkoutUrl: string; providerRef: string }> {
    if (this.current() === 'beleqet_pay') {
      const session = await this.pay.createCheckoutSession(
        {
          amount: request.amount,
          currency: request.currency,
          customerEmail: request.email,
          successRedirectUrl: request.returnUrl,
          metadata: { app: 'beleqet-jobs', ...request.metadata },
        },
        request.reference,
      );
      return { checkoutUrl: session.checkoutUrl, providerRef: session.txRef };
    }
    const checkoutUrl = await this.chapa.checkoutUrl({
      amount: request.amount,
      currency: request.currency,
      email: request.email,
      firstName: request.firstName,
      lastName: request.lastName,
      txRef: request.reference,
      returnUrl: request.returnUrl,
      title: request.title,
      description: request.description,
    });
    return { checkoutUrl, providerRef: request.reference };
  }

  /** The provider's own answer about a payment, never a webhook's word. */
  async paymentResult(providerRef: string): Promise<PaymentCheck> {
    if (!isBeleqetPayRef(providerRef)) return this.chapa.paymentResult(providerRef);
    const transaction = await this.pay.getTransaction(providerRef);
    return {
      // EXPIRED can still turn into SUCCESS when a payment lands as the page closes; that comes
      // as a webhook, and a payment marked failed meanwhile still starts its plan.
      state:
        transaction.status === 'SUCCESS'
          ? 'success'
          : transaction.status === 'PENDING'
            ? 'pending'
            : 'failed',
      amount: Number(transaction.amount),
      currency: transaction.currency ?? '',
      metadata: transaction.metadata ?? null,
      raw: transaction,
    };
  }

  /** Banks and wallets a freelancer can withdraw to. Both use Chapa's list, so codes stay valid. */
  async banks(): Promise<ChapaBank[]> {
    if (this.current() !== 'beleqet_pay') return this.chapa.banks();
    return (await this.pay.banks()).map((bank) => ({
      code: String(bank.code),
      name: bank.name,
      accountLength: bank.accountLength ?? null,
      mobileMoney: Boolean(bank.mobileMoney),
    }));
  }

  /**
   * A payout through Pay. Safe to repeat: the same reference returns the first transfer. Throws
   * when Pay can't be asked (retry later); a refusal comes back as `failed`.
   */
  async sendPayout(request: PayoutRequest): Promise<PayoutOutcome> {
    try {
      return this.outcome(
        await this.pay.createTransfer({
          reference: request.reference,
          amount: request.amount.toFixed(2),
          bankCode: request.bankCode,
          accountNumber: request.accountNumber,
          accountName: request.accountName,
          narration: 'Beleqet Jobs withdrawal',
        }),
      );
    } catch (err) {
      if (err instanceof BeleqetPayError && err.refused) {
        return { state: 'failed', reason: err.message };
      }
      throw err;
    }
  }

  async payoutStatus(reference: string): Promise<PayoutOutcome> {
    return this.outcome(await this.pay.getTransfer(reference));
  }

  private outcome(transfer: BeleqetPayTransfer): PayoutOutcome {
    if (transfer.status === 'SUCCEEDED') {
      return {
        state: 'paid',
        providerRef: transfer.transferRef,
        bankName: transfer.destination?.bankName,
      };
    }
    if (transfer.status === 'FAILED') {
      return {
        state: 'failed',
        providerRef: transfer.transferRef,
        reason: transfer.failureReason || 'The bank did not accept the payout',
      };
    }
    return {
      state: 'pending',
      providerRef: transfer.transferRef,
      bankName: transfer.destination?.bankName,
      sent: Boolean(transfer.submittedAt),
      sendBy: transfer.sendBy ?? null,
    };
  }
}
