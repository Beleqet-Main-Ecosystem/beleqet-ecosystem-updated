import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

const mockConfigService = {
  get: jest.fn((key: string) => {
    if (key === 'TOTP_ENCRYPTION_KEY') return '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    return undefined;
  }),
};

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a secret roundtrip', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const { ciphertext, keyVersion } = service.encrypt(plaintext);
    expect(ciphertext).toBeDefined();
    expect(typeof ciphertext).toBe('string');
    expect(keyVersion).toBe('v1');
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const { ciphertext: c1 } = service.encrypt(plaintext);
    const { ciphertext: c2 } = service.encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('should fail decryption with wrong key', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const { ciphertext } = service.encrypt(plaintext);

    const wrongConfig = {
      get: jest.fn((key: string) => {
        if (key === 'TOTP_ENCRYPTION_KEY') return 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';
        return undefined;
      }),
    };

    const wrongService = new EncryptionService(wrongConfig as any);
    expect(() => wrongService.decrypt(ciphertext)).toThrow();
  });

  it('should fail decryption with tampered ciphertext', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const { ciphertext } = service.encrypt(plaintext);
    const tampered = ciphertext.slice(0, -4) + 'AAAA';
    expect(() => service.decrypt(tampered)).toThrow();
  });
});
