import { randomBytes } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { TokenEncryptionService } from '../services/token-encryption.service';
import { TOKEN_ENCRYPTION_KEY } from '../config/auth.config';

describe('TokenEncryptionService', () => {
  let service: TokenEncryptionService;

  beforeEach(async () => {
    const key = randomBytes(32); // fresh valid 256-bit key per test run

    const module: TestingModule = await Test.createTestingModule({
      providers: [TokenEncryptionService, { provide: TOKEN_ENCRYPTION_KEY, useValue: key }],
    }).compile();

    service = module.get(TokenEncryptionService);
  });

  it('throws at construction time if given a key that is not 32 bytes', async () => {
    const badKey = randomBytes(16); // wrong length (AES-128, not AES-256)

    await expect(
      Test.createTestingModule({
        providers: [TokenEncryptionService, { provide: TOKEN_ENCRYPTION_KEY, useValue: badKey }],
      }).compile(),
    ).rejects.toThrow(/32-byte key/);
  });

  it('round-trips: decrypt(encrypt(x)) === x', () => {
    const plaintext = 'ya29.a0AfH6SMB_example_google_access_token';

    const ciphertext = service.encrypt(plaintext);
    const decrypted = service.decrypt(ciphertext);

    expect(decrypted).toBe(plaintext);
  });

  it('produces different ciphertext for the same plaintext on repeated calls (random IV per call)', () => {
    const plaintext = 'same-token-value';

    const first = service.encrypt(plaintext);
    const second = service.encrypt(plaintext);

    expect(first).not.toBe(second);
    // Both must still independently decrypt to the same plaintext.
    expect(service.decrypt(first)).toBe(plaintext);
    expect(service.decrypt(second)).toBe(plaintext);
  });

  it('never leaks the plaintext token as a substring of the ciphertext', () => {
    const plaintext = 'super-secret-refresh-token-value';

    const ciphertext = service.encrypt(plaintext);

    expect(ciphertext).not.toContain(plaintext);
  });

  it('throws when decrypting a ciphertext that has been tampered with', () => {
    const ciphertext = service.encrypt('sensitive-token');
    const tamperedBuffer = Buffer.from(ciphertext, 'base64');

    // Flip a byte inside the actual ciphertext region (after the 12-byte
    // IV and 16-byte auth tag) to simulate tampering/corruption.
    const tamperIndex = 12 + 16;
    tamperedBuffer[tamperIndex] = tamperedBuffer[tamperIndex] ^ 0xff;
    const tamperedCiphertext = tamperedBuffer.toString('base64');

    expect(() => service.decrypt(tamperedCiphertext)).toThrow();
  });

  it('throws when decrypting with the wrong key', async () => {
    const ciphertext = service.encrypt('token-encrypted-with-key-A');

    const differentKey = randomBytes(32);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenEncryptionService,
        { provide: TOKEN_ENCRYPTION_KEY, useValue: differentKey },
      ],
    }).compile();
    const otherService = module.get(TokenEncryptionService);

    expect(() => otherService.decrypt(ciphertext)).toThrow();
  });

  it('throws on a malformed (too-short) ciphertext payload', () => {
    const tooShort = Buffer.from('short').toString('base64');

    expect(() => service.decrypt(tooShort)).toThrow(/too short/);
  });
});
