import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EncryptionService } from './encryption.service';

describe('EncryptionService', () => {
  let service: EncryptionService;

  const mockConfigService = {
    get: jest.fn().mockReturnValue(
      // 32 bytes = 64 hex characters
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
    ),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(
      EncryptionService,
    );
  });


  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  it('should encrypt and decrypt a message correctly', () => {
    const message = 'Hello Secure Tunnel';

    const encrypted = service.encrypt(message);

    expect(encrypted).not.toEqual(message);

    const decrypted = service.decrypt(encrypted);

    expect(decrypted).toEqual(message);
  });


  it('should not allow empty messages', () => {
    expect(() => service.encrypt(''))
      .toThrow();
  });


  it('should reject invalid encrypted payload', () => {
    expect(() => service.decrypt('invalid-data'))
      .toThrow();
  });
});