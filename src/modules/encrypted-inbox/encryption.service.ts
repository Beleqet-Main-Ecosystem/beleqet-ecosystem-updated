import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Server-side encryption service for the Encrypted Inbox module.
 *
 * This service provides two layers of encryption:
 *
 * 1. **Server-side key encryption**: Encrypts/decrypts user private keys
 *    using a server-held AES-256-GCM key.  This is used solely for GDPR
 *    data-export workflows — the server can decrypt the user's encrypted
 *    private key only when the user proves identity through 2FA step-up.
 *
 * 2. **Server ciphertext**: Creates an independent encrypted copy of message
 *    content using the server-held key.  This copy is used for:
 *    - GDPR data-export (when user requests full data download)
 *    - GDPR data-deletion (to ensure all copies are scrubbed)
 *
 * **Zero-Knowledge Architecture**: Under normal operation, the server never
 * decrypts message content.  Messages are E2EE'd client-side; only the
 * recipient's private key (held client-side) can decrypt them.
 *
 * @remarks The encryption key is loaded from `E2EE_SERVER_KEY` env var
 * (64 hex characters = 32 bytes for AES-256).  Rotate quarterly.
 */
@Injectable()
export class E2EEServerEncryptionService {
  private readonly logger = new Logger(E2EEServerEncryptionService.name);
  private readonly key: Buffer;
  private readonly keyVersion: string;

  constructor(private readonly config: ConfigService) {
    const raw = this.config.get<string>('E2EE_SERVER_KEY');
    if (!raw) {
      throw new Error(
        'E2EE_SERVER_KEY is required for GDPR server-side encryption. Generate with: openssl rand -hex 32',
      );
    }
    const normalized = raw.length === 64 ? raw : raw.slice(0, 64);
    this.key = Buffer.from(normalized, 'hex');
    if (this.key.length !== 32) {
      throw new Error('E2EE_SERVER_KEY must be 64 hex characters (32 bytes for AES-256).');
    }
    this.keyVersion = this.config.get<string>('E2EE_KEY_VERSION', 'v1');
  }

  /**
   * Encrypt plaintext using AES-256-GCM with a random IV.
   *
   * @param plaintext - The plaintext string to encrypt
   * @returns Base64-encoded payload: `[IV (16)] [Auth Tag (16)] [Ciphertext]`
   */
  encrypt(plaintext: string): { ciphertext: string; iv: string; keyVersion: string } {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, authTag, encrypted]);
    return {
      ciphertext: payload.toString('base64'),
      iv: iv.toString('base64'),
      keyVersion: this.keyVersion,
    };
  }

  /**
   * Decrypt a base64-encoded ciphertext produced by `encrypt()`.
   *
   * @param ciphertext - Base64-encoded payload from `encrypt()`
   * @returns The original plaintext string
   * @throws Error if decryption fails (tampered data, wrong key)
   */
  decrypt(ciphertext: string): string {
    const payload = Buffer.from(ciphertext, 'base64');
    const iv = payload.subarray(0, IV_LENGTH);
    const authTag = payload.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const encrypted = payload.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }

  /**
   * Generate a random AES-256-GCM key for client-side E2EE.
   *
   * This is used when bootstrapping a new client-side encryption context.
   * The key is returned to the client and never stored server-side.
   *
   * @returns Hex-encoded 32-byte key
   */
  generateClientKey(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Derive a per-message AES-256 key from a shared secret using HKDF.
   *
   * @param sharedSecret - Shared secret from key exchange
   * @param salt - Random salt for derivation
   * @param info - Context information for HKDF
   * @returns Hex-encoded 32-byte derived key
   */
  deriveMessageKey(sharedSecret: string, salt: string, info: string): string {
    const secretBuffer = Buffer.from(sharedSecret, 'hex');
    const saltBuffer = Buffer.from(salt, 'hex');
    const infoBuffer = Buffer.from(info, 'utf8');
    const derivedKey = crypto.hkdfSync('sha256', secretBuffer, saltBuffer, infoBuffer, 32);
    if (!derivedKey) {
      throw new Error('Key derivation failed');
    }
    return Buffer.from(derivedKey).toString('hex');
  }

  /** Returns the current key version identifier */
  getKeyVersion(): string {
    return this.keyVersion;
  }
}
