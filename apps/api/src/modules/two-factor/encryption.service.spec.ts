import { Test, TestingModule } from '@nestjs/testing';
import { EncryptionService } from '../../common/encryption/encryption.service';
import { ENCRYPTION_KEY } from '../../common/encryption/encryption.constants';

const TEST_ENCRYPTION_KEY = Buffer.from(
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  'hex',
);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [EncryptionService, { provide: ENCRYPTION_KEY, useValue: TEST_ENCRYPTION_KEY }],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt and decrypt a secret roundtrip', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const ciphertext = service.encrypt(plaintext);
    expect(ciphertext).toBeDefined();
    expect(typeof ciphertext).toBe('string');
    expect(ciphertext).not.toBe(plaintext);

    const decrypted = service.decrypt(ciphertext);
    expect(decrypted).toBe(plaintext);
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const c1 = service.encrypt(plaintext);
    const c2 = service.encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });

  it('should fail decryption with wrong key', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const ciphertext = service.encrypt(plaintext);

    const wrongKey = Buffer.from(
      'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
      'hex',
    );
    const wrongService = new EncryptionService(wrongKey);
    expect(() => wrongService.decrypt(ciphertext)).toThrow();
  });

  it('should fail decryption with tampered ciphertext', () => {
    const plaintext = 'JBSWY3DPEHPK3PXP';
    const ciphertext = service.encrypt(plaintext);
    const tampered = ciphertext.slice(0, -4) + 'AAAA';
    expect(() => service.decrypt(tampered)).toThrow();
  });
});
