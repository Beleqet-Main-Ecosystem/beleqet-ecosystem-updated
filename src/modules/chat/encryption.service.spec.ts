import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from './encryption.service';
import { ConfigService } from '@nestjs/config';

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const mockConfig = {
      get: jest.fn().mockReturnValue('test-secret-key-32-chars-long-value!'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ---------------------------------------------------------------------
  // Startup safety: the service must refuse to run without a real key,
  // rather than silently falling back to something insecure.
  // ---------------------------------------------------------------------
  describe('key configuration', () => {
    it('throws if BACKEND_ENCRYPTION_KEY is not set', () => {
      const badConfig = { get: jest.fn().mockReturnValue(undefined) };
      expect(() => new EncryptionService(badConfig as any)).toThrow(
        'Missing required environment variable BACKEND_ENCRYPTION_KEY',
      );
    });

    it('throws if BACKEND_ENCRYPTION_KEY is an empty string', () => {
      const badConfig = { get: jest.fn().mockReturnValue('') };
      expect(() => new EncryptionService(badConfig as any)).toThrow(
        'Missing required environment variable BACKEND_ENCRYPTION_KEY',
      );
    });
  });

  // ---------------------------------------------------------------------
  // Core contract: whatever goes in via encrypt() must come back out
  // identical via decrypt(), across a range of realistic inputs.
  // ---------------------------------------------------------------------
  describe('encrypt/decrypt round-trip', () => {
    it('encrypts and decrypts a plaintext string correctly', () => {
      const plaintext = 'Hello Beleqet Secure E2EE World!';
      const encrypted = service.encrypt(plaintext);

      expect(encrypted).toContain(':');
      expect(encrypted.split(':')).toHaveLength(3);

      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('round-trips an empty string', () => {
      const encrypted = service.encrypt('');
      expect(service.decrypt(encrypted)).toBe('');
    });

    it('round-trips unicode and emoji correctly', () => {
      const plaintext = 'hello 👋 世界 مرحبا';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('round-trips Amharic text correctly', () => {
      const plaintext = 'ሰላም ለሁላችሁም';
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });

    it('round-trips a long message', () => {
      const plaintext = 'A'.repeat(10_000);
      const encrypted = service.encrypt(plaintext);
      expect(service.decrypt(encrypted)).toBe(plaintext);
    });
  });

  // ---------------------------------------------------------------------
  // Security guarantee #1: every encryption uses a fresh random IV, so
  // identical plaintexts never produce identical ciphertext. This is what
  // prevents pattern analysis on repeated messages.
  // ---------------------------------------------------------------------
  describe('IV randomness', () => {
    it('produces different ciphertext for the same plaintext', () => {
      const plaintext = 'same message';
      const first = service.encrypt(plaintext);
      const second = service.encrypt(plaintext);
      expect(first).not.toBe(second);
    });

    it('uses a different IV on each call', () => {
      const firstIv = service.encrypt('same message').split(':')[0];
      const secondIv = service.encrypt('same message').split(':')[0];
      expect(firstIv).not.toBe(secondIv);
    });
  });

  // ---------------------------------------------------------------------
  // Security guarantee #2: only the correct key can decrypt data. If key
  // derivation were ever broken (e.g. accidentally hardcoded), this is
  // the test that would catch it — nothing else in this file would.
  // ---------------------------------------------------------------------
  describe('key isolation', () => {
    it('fails to decrypt data encrypted under a different key', () => {
      const otherConfig = {
        get: jest.fn().mockReturnValue('a-completely-different-secret-key!'),
      };
      const otherService = new EncryptionService(otherConfig as any);

      const encrypted = otherService.encrypt('secret message');
      expect(() => service.decrypt(encrypted)).toThrow('Decryption failed');
    });
  });

  // ---------------------------------------------------------------------
  // Security guarantee #3: GCM's auth tag must catch any tampering with
  // the payload — ciphertext, auth tag, or IV — and malformed payloads
  // must be rejected without leaking internal error detail to the caller.
  // ---------------------------------------------------------------------
  describe('tamper detection and malformed input', () => {
    it('fails decryption if the payload format is invalid', () => {
      expect(() => service.decrypt('invalid_format')).toThrow('Decryption failed');
    });

    it('fails decryption if the ciphertext is tampered with', () => {
      const encrypted = service.encrypt('Super secret message');
      const parts = encrypted.split(':');

      parts[2] = flipLastHexChar(parts[2]);
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
    });

    it('fails decryption if the auth tag is tampered with', () => {
      const encrypted = service.encrypt('Super secret message');
      const parts = encrypted.split(':');

      parts[1] = flipLastHexChar(parts[1]);
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
    });

    it('fails decryption if the IV is tampered with', () => {
      const encrypted = service.encrypt('Super secret message');
      const parts = encrypted.split(':');

      parts[0] = flipLastHexChar(parts[0]);
      const tampered = parts.join(':');

      expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
    });

    it('never leaks the internal error reason to the caller', () => {
      expect.assertions(1);
      // Whatever breaks internally (bad hex, tag mismatch, wrong key),
      // the caller should only ever see the generic message below —
      // never crypto library internals that could aid an attacker.
      try {
        service.decrypt('not:valid:hex!!');
      } catch (err) {
        expect((err as Error).message).toBe('Decryption failed');
      }
    });
  });
});

/**
 * Flips the last hex character of a hex string, keeping it valid hex
 * so the corruption exercises auth-tag/format checks rather than a
 * Buffer.from() parsing failure.
 */
function flipLastHexChar(hex: string): string {
  const last = hex[hex.length - 1];
  const replacement = last === '0' ? '1' : '0';
  return hex.substring(0, hex.length - 1) + replacement;
}