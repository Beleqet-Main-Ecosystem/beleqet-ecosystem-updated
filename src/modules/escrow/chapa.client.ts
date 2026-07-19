import { BadGatewayException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ChapaInitializeRequest,
  ChapaInitializeResponse,
  ChapaVerifyResponse,
} from './chapa.types';

@Injectable()
export class ChapaClient {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config
      .get<string>('CHAPA_BASE_URL', 'https://api.chapa.co/v1')
      .replace(/\/$/, '');
  }

  /**
   * Initializes the hosted Chapa checkout used to fund an escrow transaction.
   * The returned checkout URL is not treated as proof of payment; webhooks are
   * verified through `verifyTransaction` before funds become locked.
   */
  async initializePayment(request: ChapaInitializeRequest): Promise<ChapaInitializeResponse> {
    return this.post<ChapaInitializeResponse>('/transaction/initialize', {
      amount: request.amount,
      currency: request.currency,
      email: request.email,
      first_name: request.firstName,
      last_name: request.lastName,
      tx_ref: request.txRef,
      callback_url: request.callbackUrl,
      return_url: request.returnUrl,
      customization: {
        title: request.title,
        description: request.description,
      },
    });
  }

  /**
   * Reads Chapa's transaction status. Escrow state transitions rely on this
   * server-to-server verification rather than trusting webhook JSON alone.
   */
  async verifyTransaction(txRef: string): Promise<ChapaVerifyResponse> {
    return this.get<ChapaVerifyResponse>(`/transaction/verify/${encodeURIComponent(txRef)}`);
  }

  private async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers(),
    });
    return this.parse<T>(response);
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify(body),
    });
    return this.parse<T>(response);
  }

  private headers() {
    const secretKey = this.config.getOrThrow<string>('CHAPA_SECRET_KEY');
    return {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
    };
  }

  private async parse<T>(response: Response): Promise<T> {
    const text = await response.text();
    const payload = text
      ? (JSON.parse(text) as T & { message?: string })
      : ({} as T & { message?: string });

    if (!response.ok) {
      throw new BadGatewayException({
        message: payload.message ?? 'Chapa request failed',
        statusCode: response.status,
        provider: payload,
      });
    }

    return payload;
  }
}
