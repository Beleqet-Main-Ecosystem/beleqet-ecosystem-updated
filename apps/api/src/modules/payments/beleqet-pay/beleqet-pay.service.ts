import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BeleqetPayBank,
  BeleqetPayCheckoutRequest,
  BeleqetPayCheckoutSession,
  BeleqetPayTransaction,
  BeleqetPayTransfer,
  BeleqetPayTransferRequest,
} from './beleqet-pay.types';

/** Pay's transaction references; Chapa's are ours (CHAPA-…, E-…), so the two never mix. */
export const isBeleqetPayRef = (reference: string | null | undefined): boolean =>
  typeof reference === 'string' && reference.startsWith('TX-BLQ-');

/**
 * Pay answered with an error. `payStatus` is Pay's HTTP status, or 502 when Pay couldn't be reached
 * or answered something that wasn't JSON. Callers see a 502.
 */
export class BeleqetPayError extends HttpException {
  constructor(
    message: string,
    readonly payStatus: number,
  ) {
    super(message, HttpStatus.BAD_GATEWAY);
  }

  /** Pay refused the request and nothing happened (not a conflict, rate limit or outage). */
  get refused(): boolean {
    return (
      this.payStatus >= 400 &&
      this.payStatus < 500 &&
      this.payStatus !== 409 &&
      this.payStatus !== 429
    );
  }
}

const TIMEOUT_MS = 20_000;

/**
 * Beleqet Pay, Beleqet's own payment service, which holds the Chapa account: hosted checkout,
 * payment status, the payout bank list and payouts. On the server Jobs reaches it inside Docker
 * (BELEQET_PAY_API_URL, http://beleqet-pay-api:4001); the key (BELEQET_PAY_SERVICE_KEY, blq_test_… or
 * blq_live_…) decides test or live mode.
 */
@Injectable()
export class BeleqetPayService {
  private readonly logger = new Logger(BeleqetPayService.name);

  constructor(private readonly config: ConfigService) {}

  /** True once a key is set; payments go through Pay only then (and with PAYMENTS_VIA=beleqet_pay). */
  isConfigured(): boolean {
    return Boolean(this.key());
  }

  /** A hosted checkout. The same `idempotencyKey` within 24 hours returns the same session. */
  createCheckoutSession(
    request: BeleqetPayCheckoutRequest,
    idempotencyKey: string,
  ): Promise<BeleqetPayCheckoutSession> {
    return this.request('POST', '/checkout/sessions', request, idempotencyKey);
  }

  getTransaction(txRef: string): Promise<BeleqetPayTransaction> {
    return this.request('GET', `/transactions/${encodeURIComponent(txRef)}`);
  }

  banks(): Promise<BeleqetPayBank[]> {
    return this.request('GET', '/transfers/banks');
  }

  /** A payout. Sending the same reference again returns the first transfer, never a second one. */
  createTransfer(request: BeleqetPayTransferRequest): Promise<BeleqetPayTransfer> {
    return this.request('POST', '/transfers', request, request.reference);
  }

  getTransfer(reference: string): Promise<BeleqetPayTransfer> {
    return this.request('GET', `/transfers/${encodeURIComponent(reference)}`);
  }

  private key(): string {
    return this.config.get<string>('BELEQET_PAY_SERVICE_KEY')?.trim() ?? '';
  }

  private baseUrl(): string {
    const url = (this.config.get<string>('BELEQET_PAY_API_URL') || 'http://beleqet-pay-api:4001')
      .trim()
      .replace(/\/+$/, '');
    return url.endsWith('/v1') ? url : `${url}/v1`;
  }

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    idempotencyKey?: string,
  ): Promise<T> {
    const key = this.key();
    if (!key) throw new BeleqetPayError('Beleqet Pay is not set up (BELEQET_PAY_SERVICE_KEY)', 502);
    let response: Response;
    try {
      response = await fetch(`${this.baseUrl()}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (err) {
      this.logger.warn(`${method} ${path}: Beleqet Pay unreachable: ${(err as Error).message}`);
      throw new BeleqetPayError('Beleqet Pay is unreachable', 502);
    }

    const text = await response.text();
    let payload: unknown;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new BeleqetPayError(`Beleqet Pay answered HTTP ${response.status} without JSON`, 502);
    }
    if (!response.ok) {
      const message = (payload as { message?: unknown }).message;
      const said = Array.isArray(message) ? message.join(', ') : String(message ?? '');
      this.logger.warn(`${method} ${path}: HTTP ${response.status} ${said}`);
      throw new BeleqetPayError(
        said || `Beleqet Pay answered HTTP ${response.status}`,
        response.status,
      );
    }
    return payload as T;
  }
}
