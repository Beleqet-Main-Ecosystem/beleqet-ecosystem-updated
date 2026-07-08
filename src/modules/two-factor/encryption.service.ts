import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY_VERSION = 'v1';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

@Injectable()
/** AES-256-GCM encryption service for protecting TOTP secrets at rest.
 *  Uses a random 16-byte IV per record and stores the 16-byte GCM auth tag
 *  alongside the ciphertext in a single base64-encoded payload:
 *    `[IV (16 bytes)] [Auth Tag (16 bytes)] [Ciphertext (variable)]`
 *
 *  The encryption key is loaded from the `TOTP_ENCRYPTION_KEY` environment variable
 *  (64 hex characters = 32 bytes for AES-256). */
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly key: Buffer;

  constructor(config: ConfigService) {
    const raw = config.get<string>('TOTP_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error(
        'TOTP_ENCRYPTION_KEY is required. Generate with: openssl rand -hex 32',
      );
    }
    const normalized = raw.length === 64 ? raw : raw.slice(0, 64);
    this.key = Buffer.from(normalized, 'hex');
    if (this.key.length !== 32) {
      throw new Error(
        'TOTP_ENCRYPTION_KEY must be 64 hex characters (32 bytes for AES-256). Generate with: openssl rand -hex 32',
      );
    }
  }

  /** Encrypt a plaintext string using AES-256-GCM with a random IV.
   *  @returns Base64-encoded ciphertext (IV + auth tag + encrypted data) and key version string. */
  encrypt(plaintext: string): { ciphertext: string; keyVersion: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, authTag, encrypted]);
    return { ciphertext: payload.toString('base64'), keyVersion: KEY_VERSION };
  }

  /** Decrypt a base64-encoded ciphertext produced by `encrypt()`.
   *  Extracts the IV, auth tag, and ciphertext from the payload, validates
   *  integrity via GCM auth tag, and returns the original plaintext. */
  decrypt(ciphertext: string): string {
    const payload = Buffer.from(ciphertext, 'base64');
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }
}
