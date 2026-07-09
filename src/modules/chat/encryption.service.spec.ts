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

  it('should encrypt and decrypt a plaintext string correctly', () => {
    const plaintext = 'Hello Beleqet Secure E2EE World!';
    const encrypted = service.encrypt(plaintext);
    
    expect(encrypted).toContain(':');
    expect(encrypted.split(':')).toHaveLength(3);
    
    const decrypted = service.decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('should fail decryption if payload format is invalid', () => {
    expect(() => service.decrypt('invalid_format')).toThrow('Decryption failed');
  });

  it('should fail decryption if ciphertext or auth tag is tampered with', () => {
    const plaintext = 'Super secret message';
    const encrypted = service.encrypt(plaintext);
    const parts = encrypted.split(':');
    
    // Tamper with the ciphertext (change last character)
    parts[2] = parts[2].substring(0, parts[2].length - 1) + (parts[2].endsWith('0') ? '1' : '0');
    const tampered = parts.join(':');

    expect(() => service.decrypt(tampered)).toThrow('Decryption failed');
  });
});
