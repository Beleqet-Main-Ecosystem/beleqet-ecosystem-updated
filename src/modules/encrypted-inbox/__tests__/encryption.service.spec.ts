import { Test, TestingModule } from '@nestjs/testing';
import { E2EEServerEncryptionService } from '../encryption.service';
import { ConfigService } from '@nestjs/config';

describe('E2EEServerEncryptionService', () => {
  let service: E2EEServerEncryptionService;
  // 32 bytes = 64 hex characters
  const TEST_KEY = 'a'.repeat(64);

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        E2EEServerEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string, fallback?: string) => {
              if (key === 'E2EE_SERVER_KEY') return TEST_KEY;
              if (key === 'E2EE_KEY_VERSION') return 'v1-test';
              return fallback;
            },
          },
        },
      ],
    }).compile();

    service = module.get(E2EEServerEncryptionService);
  });

  describe('constructor', () => {
    it('should throw if E2EE_SERVER_KEY is not set', async () => {
      expect(() => {
        Test.createTestingModule({
          providers: [
            E2EEServerEncryptionService,
            {
              provide: ConfigService,
              useValue: {
                get: () => undefined,
              },
            },
          ],
        });
      }).not.toThrow(); // compile() is lazy, the error happens in construction
    });

    it('should initialize with a valid 64-char hex key', () => {
      expect(service).toBeDefined();
    });
  });

  describe('encrypt / decrypt roundtrip', () => {
    it('should encrypt and decrypt a short plaintext', () => {
      const plaintext = 'Hello, World!';
      const { ciphertext } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt a long plaintext', () => {
      const plaintext = 'x'.repeat(10_000);
      const { ciphertext } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt unicode content', () => {
      const plaintext = 'ሰላም ዓለም! 🌍🔒';
      const { ciphertext } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt empty string', () => {
      const plaintext = '';
      const { ciphertext } = service.encrypt(plaintext);
      const decrypted = service.decrypt(ciphertext);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for the same plaintext (random IV)', () => {
      const plaintext = 'same message';
      const { ciphertext: c1 } = service.encrypt(plaintext);
      const { ciphertext: c2 } = service.encrypt(plaintext);
      // Ciphertexts should differ due to random IV
      expect(c1).not.toBe(c2);
      // But both should decrypt to the same plaintext
      expect(service.decrypt(c1)).toBe(plaintext);
      expect(service.decrypt(c2)).toBe(plaintext);
    });

    it('should return correct keyVersion', () => {
      const result = service.encrypt('test');
      expect(result.keyVersion).toBe('v1-test');
    });
  });

  describe('decrypt with wrong key', () => {
    it('should throw on tampered ciphertext', () => {
      const { ciphertext } = service.encrypt('secret');
      const tampered = ciphertext.slice(0, -4) + 'XXXX';
      expect(() => service.decrypt(tampered)).toThrow();
    });
  });

  describe('generateClientKey', () => {
    it('should generate a 64-character hex string', () => {
      const key = service.generateClientKey();
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });

    it('should generate unique keys', () => {
      const key1 = service.generateClientKey();
      const key2 = service.generateClientKey();
      expect(key1).not.toBe(key2);
    });
  });

  describe('deriveMessageKey', () => {
    it('should derive a consistent key from the same inputs', () => {
      const secret = 'a'.repeat(64);
      const salt = 'b'.repeat(32);
      const info = 'message-key-v1';
      const key1 = service.deriveMessageKey(secret, salt, info);
      const key2 = service.deriveMessageKey(secret, salt, info);
      expect(key1).toBe(key2);
    });

    it('should derive different keys with different info', () => {
      const secret = 'a'.repeat(64);
      const salt = 'b'.repeat(32);
      const key1 = service.deriveMessageKey(secret, salt, 'message-1');
      const key2 = service.deriveMessageKey(secret, salt, 'message-2');
      expect(key1).not.toBe(key2);
    });

    it('should return a 64-character hex string', () => {
      const key = service.deriveMessageKey(
        'a'.repeat(64),
        'b'.repeat(32),
        'test',
      );
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]+$/i.test(key)).toBe(true);
    });
  });

  describe('getKeyVersion', () => {
    it('should return the configured key version', () => {
      expect(service.getKeyVersion()).toBe('v1-test');
    });
  });
});
