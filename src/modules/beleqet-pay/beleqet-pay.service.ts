import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BeleqetPayCheckoutRequest,
  BeleqetPayCheckoutResponse,
  BeleqetPayEscrowRequest,
  BeleqetPayEscrowResponse,
  BeleqetPayTransaction,
} from './beleqet-pay.types';

/**
 * HTTP client that proxies payment operations from the main Beleqet Jobs
 * backend to the standalone Beleqet Pay microservice.
 *
 * All methods throw {@link BadGatewayException} on network or protocol errors
 * so callers can rely on standard NestJS exception handling.
 */
@Injectable()
export class BeleqetPayService {
  private readonly logger = new Logger(BeleqetPayService.name);
  private readonly baseUrl: string;
  private readonly serviceKey: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = (
      this.config.get<string>('BELEQET_PAY_API_URL', 'http://localhost:4001') + '/v1'
    ).replace(/\/v1\/v1/, '/v1'); // guard against double-prefix

    this.serviceKey = this.config.getOrThrow<string>('BELEQET_PAY_SERVICE_KEY');
  }

  /**
   * Creates a hosted checkout session in Beleqet Pay and returns the URL
   * the user should be redirected to in order to complete payment.
   *
   * @param req - Checkout parameters including amount, currency and redirect URLs.
   */
  async createCheckoutSession(
    req: BeleqetPayCheckoutRequest,
  ): Promise<BeleqetPayCheckoutResponse> {
    this.logger.debug(
      `[checkout] amount=${req.amount} ${req.currency} provider=${req.preferredProvider ?? 'auto'}`,
    );
    return this.post<BeleqetPayCheckoutResponse>('/checkout/sessions', req);
  }

  /**
   * Fetches the current state of a transaction from Beleqet Pay.
   * Used by the escrow webhook processor to re-verify payment status before
   * transitioning an escrow to FUNDED.
   */
  async getTransaction(txRef: string): Promise<BeleqetPayTransaction> {
    return this.get<BeleqetPayTransaction>(`/transactions/${encodeURIComponent(txRef)}`);
  }

  /**
   * Creates an escrow smart-contract record in Beleqet Pay.
   * Returns the contract ID that the main app stores alongside its own
   * EscrowTransaction row for cross-service reconciliation.
   */
  async createEscrowContract(req: BeleqetPayEscrowRequest): Promise<BeleqetPayEscrowResponse> {
    return this.post<BeleqetPayEscrowResponse>('/web3/escrow', req);
  }

  // ─── private helpers ────────────────────────────────────────────────────────

  private headers(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.serviceKey}`,
      'Content-Type': 'application/json',
      'X-Service-Name': 'beleqet-jobs',
    };
  }

  private async get<T>(path: string): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers: this.headers() });
    } catch (err) {
      this.logger.error(`[GET ${path}] Network error: ${(err as Error).message}`);
      throw new BadGatewayException('Beleqet Pay microservice is unreachable');
    }
    return this.parse<T>(response, `GET ${path}`);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify(body),
      });
    } catch (err) {
      this.logger.error(`[POST ${path}] Network error: ${(err as Error).message}`);
      throw new BadGatewayException('Beleqet Pay microservice is unreachable');
    }
    return this.parse<T>(response, `POST ${path}`);
  }

  private async parse<T>(response: Response, label: string): Promise<T> {
    const text = await response.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let payload: any;

    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new BadGatewayException({
        message: 'Beleqet Pay returned a non-JSON response',
        statusCode: response.status,
        body: text.slice(0, 500),
      });
    }

    if (!response.ok) {
      this.logger.error(`[${label}] HTTP ${response.status}: ${text.slice(0, 300)}`);
      throw new BadGatewayException({
        message: payload?.message ?? `Beleqet Pay request failed (HTTP ${response.status})`,
        statusCode: response.status,
        provider: payload,
      });
    }

    return payload as T;
  }
}
