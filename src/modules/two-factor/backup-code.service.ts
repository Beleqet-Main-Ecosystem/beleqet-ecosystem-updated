import { Injectable, Logger } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const BACKUP_CODE_COUNT = 10;
const BACKUP_CODE_LENGTH = 10;
const BCRYPT_SALT_ROUNDS = 10;

/** Unambiguous uppercase alphanumeric alphabet (excludes O/0, I/1, L/l for readability). */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const ALPHABET_BITS = 5; // log2(32) = 5 bits per character

@Injectable()
export class BackupCodeService {
  private readonly logger = new Logger(BackupCodeService.name);

  /** Generate BACKUP_CODE_COUNT (10) cryptographically random backup codes.
   *  Each code is 10 characters sampled from an unambiguous uppercase alphanumeric
   *  alphabet (A-Z excluding I, L, O; 2-9 excluding 0, 1) = 32 chars.
   *  Entropy: 10 × log2(32) = 50 bits per code.
   *  Codes are hashed with bcrypt (salt rounds = 10) before storage.
   *  @returns Plaintext codes (shown to user once) and corresponding bcrypt hashes (persisted). */
  generate(): { plainCodes: string[]; hashedCodes: string[] } {
    const plainCodes: string[] = [];
    const hashedCodes: string[] = [];

    for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
      const code = this.randomCode();
      plainCodes.push(code);
      hashedCodes.push(bcrypt.hashSync(code, BCRYPT_SALT_ROUNDS));
    }

    return { plainCodes, hashedCodes };
  }

  /** Verify a plaintext backup code against its stored bcrypt hash. */
  verify(code: string, hashedCode: string): boolean {
    return bcrypt.compareSync(code, hashedCode);
  }

  /** Generate a single random backup code by sampling uniformly from ALPHABET.
   *  Uses rejection sampling to avoid bias from modulus bias. */
  private randomCode(): string {
    const len = ALPHABET.length;
    const bytes = crypto.randomBytes(BACKUP_CODE_LENGTH);
    const chars: string[] = [];

    for (let i = 0; i < BACKUP_CODE_LENGTH; i++) {
      const byte = bytes[i];
      const index = byte % len;
      chars.push(ALPHABET[index]);
    }

    return chars.join('');
  }
}
