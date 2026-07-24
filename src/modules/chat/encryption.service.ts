import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

/**
 * Service providing server‑side encryption and decryption utilities (AES‑256‑GCM).
 * Used for encrypting data at rest, such as user public keys.
 * Requires the `BACKEND_ENCRYPTION_KEY` environment variable; if missing the
 * service will abort application startup to avoid insecure defaults.
 */

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const secret = this.configService.get<string>('BACKEND_ENCRYPTION_KEY');
    if (!secret) {
      this.logger.error('BACKEND_ENCRYPTION_KEY is not set – aborting startup');
      throw new Error('Missing required environment variable BACKEND_ENCRYPTION_KEY');
    }
    // Ensure key is exactly 32 bytes (256 bits)
    this.key = crypto.scryptSync(secret, 'salt', 32);
  }

  /**
   * Encrypts a plaintext string.
   * @param plaintext Data to encrypt
   * @returns Encrypted payload in format `iv:authTag:ciphertext` (all hex encoded)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  }

  /**
   * Decrypts a ciphertext string.
   * @param encryptedPayload Payload in format `iv:authTag:ciphertext`
   * @returns Decrypted plaintext string
   */
  decrypt(encryptedPayload: string): string {
    try {
      const parts = encryptedPayload.split(':');
      if (parts.length !== 3) {
        throw new Error('Invalid encrypted payload format');
      }

      const iv = Buffer.from(parts[0], 'hex');
      const authTag = Buffer.from(parts[1], 'hex');
      const ciphertext = parts[2];

      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (err) {
      this.logger.error(`Decryption failed: ${(err as Error).message}`);
      throw new Error('Decryption failed');
    }
  }
}
