import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class ChapaSignatureService {
  constructor(private readonly config: ConfigService) {}

  /**
   * Verifies Chapa webhook headers with a constant-time comparison. Chapa
   * integrations may send `x-chapa-signature` for payload HMACs or
   * `chapa-signature` for secret-based verification, so both are supported.
   */
  verifyWebhook(rawBody: Buffer, headers: Record<string, string | string[] | undefined>): boolean {
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');
    if (!secret) {
      return false;
    }

    const payloadSignature = this.header(headers, 'x-chapa-signature');
    const secretSignature = this.header(headers, 'chapa-signature');
    const payloadHash = this.hmac(rawBody.toString('utf8'), secret);
    const secretHash = this.hmac(secret, secret);

    return this.safeEquals(payloadSignature, payloadHash) || this.safeEquals(secretSignature, secretHash);
  }

  hmac(value: string, secret: string): string {
    return createHmac('sha256', secret).update(value).digest('hex');
  }

  private header(headers: Record<string, string | string[] | undefined>, name: string): string | undefined {
    const value = Object.entries(headers).find(([key]) => key.toLowerCase() === name)?.[1];
    return Array.isArray(value) ? value[0] : value;
  }

  private safeEquals(left: string | undefined, right: string): boolean {
    if (!left) {
      return false;
    }

    const leftBuffer = Buffer.from(left, 'hex');
    const rightBuffer = Buffer.from(right, 'hex');
    return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
  }
}
