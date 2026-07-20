import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ChapaSignatureService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Verifies Chapa webhook headers with a constant-time comparison. Chapa
   * integrations may send either `x-chapa-signature` or `chapa-signature`;
   * both are treated as payload HMACs. Never compare against a static secret
   * hash, because that would allow replaying one header value for any payload.
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');
    if (!secret) {
      return false;
    }

    const payloadSignature = this.header(headers, 'x-chapa-signature');
    const chapaSignature = this.header(headers, 'chapa-signature');
    const payloadHash = this.hmac(rawBody.toString('utf8'), secret);

    return (
      this.safeEquals(payloadSignature, payloadHash) || this.safeEquals(chapaSignature, payloadHash)
    );
  }

  hmac(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private header(
    headers: Record<string, string | string[] | undefined>,
    name: string,
  ): string | undefined {
    const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    return Array.isArray(value) ? value[0] : value;
  }

  private safeEquals(left: string | undefined, right: string): boolean {
    const normalized = this.normalizeSignature(left);
    if (!normalized) {
      return false;
    }

    const leftBuffer = Buffer.from(normalized, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }

  private normalizeSignature(value: string | undefined): string | undefined {
    const signature = value?.trim().replace(/^sha256=/i, '');
    return signature && /^[a-f0-9]{64}$/i.test(signature) ? signature : undefined;
  }
}
