import { Inject, Injectable } from '@nestjs/common';
import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { ITokenCipher } from '../interfaces/token-cipher.interface';
import { TOKEN_ENCRYPTION_KEY } from '../config/auth.config';

/** AES-256-GCM algorithm identifier for Node's `crypto` module. */
const ALGORITHM = 'aes-256-gcm';

/** Recommended IV length for GCM mode, in bytes. */
const IV_LENGTH_BYTES = 12;

/** GCM authentication tag length, in bytes. */
const AUTH_TAG_LENGTH_BYTES = 16;

/**
 * Encrypts and decrypts OAuth access/refresh tokens using AES-256-GCM
 * before they are ever written to the database, satisfying the
 * GDPR "encryption of tokens at rest" requirement.
 *
 * ## Format
 *
 * Each ciphertext is a single base64 string encoding, in order:
 * `[12-byte IV][16-byte auth tag][variable-length ciphertext]`.
 * Storing IV and tag alongside the ciphertext (rather than in separate
 * columns) keeps the persisted shape a single opaque string, matching
 * the `encryptedAccessToken String?` column shape in the Prisma schema.
 *
 * ## Key management
 *
 * The key is injected as a raw 32-byte `Buffer` (see
 * {@link TOKEN_ENCRYPTION_KEY}) rather than read from `process.env`
 * inside this class, so this service has no knowledge of *where* the key
 * comes from — in production this factory can be swapped to pull from a
 * secrets manager or KMS without changing this class at all.
 *
 * A fresh random IV is generated for every single `encrypt` call, which
 * is mandatory for GCM's security guarantees — reusing an IV with the
 * same key catastrophically breaks confidentiality.
 */
@Injectable()
export class TokenEncryptionService implements ITokenCipher {
  constructor(
    @Inject(TOKEN_ENCRYPTION_KEY) private readonly key: Buffer,
  ) {
    if (this.key.length !== 32) {
      // Defensive re-check: the factory provider should already guarantee
      // this via loadAuthEnvConfig, but a service handling encryption
      // keys should never trust its inputs implicitly.
      throw new Error(
        `TokenEncryptionService requires a 32-byte key, received ${this.key.length} bytes.`,
      );
    }
  }

  /** {@inheritdoc ITokenCipher.encrypt} */
  public encrypt(plaintext: string): string {
    const iv = randomBytes(IV_LENGTH_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
  }

  /** {@inheritdoc ITokenCipher.decrypt} */
  public decrypt(ciphertext: string): string {
    const payload = Buffer.from(ciphertext, 'base64');

    if (payload.length < IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES) {
      throw new Error('Malformed ciphertext: payload too short to contain IV and auth tag.');
    }

    const iv = payload.subarray(0, IV_LENGTH_BYTES);
    const authTag = payload.subarray(
      IV_LENGTH_BYTES,
      IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES,
    );
    const encrypted = payload.subarray(IV_LENGTH_BYTES + AUTH_TAG_LENGTH_BYTES);

    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    // decipher.final() throws if authentication fails (tampering or
    // wrong key) — this propagates as a plain Error to the caller.
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }
}
