import { Test, TestingModule } from '@nestjs/testing';
import { BackupCodeService } from './backup-code.service';

describe('BackupCodeService', () => {
  let service: BackupCodeService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [BackupCodeService],
    }).compile();

    service = module.get<BackupCodeService>(BackupCodeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should generate 10 backup codes', () => {
    const { plainCodes, hashedCodes } = service.generate();
    expect(plainCodes).toHaveLength(10);
    expect(hashedCodes).toHaveLength(10);
  });

  it('should generate codes of correct length', () => {
    const { plainCodes } = service.generate();
    for (const code of plainCodes) {
      expect(code).toHaveLength(10);
    }
  });

  it('should generate unique codes', () => {
    const { plainCodes } = service.generate();
    const unique = new Set(plainCodes);
    expect(unique.size).toBe(10);
  });

  it('should verify a valid backup code', () => {
    const { plainCodes, hashedCodes } = service.generate();
    for (let i = 0; i < 10; i++) {
      expect(service.verify(plainCodes[i], hashedCodes[i])).toBe(true);
    }
  });

  it('should reject an invalid backup code', () => {
    const { hashedCodes } = service.generate();
    expect(service.verify('INVALID1234', hashedCodes[0])).toBe(false);
  });

  it('should contain only unambiguous uppercase alphanumeric chars', () => {
    const { plainCodes } = service.generate();
    const alphabet = new Set('ABCDEFGHJKMNPQRSTUVWXYZ23456789');
    for (const code of plainCodes) {
      for (const ch of code) {
        expect(alphabet.has(ch)).toBe(true);
      }
    }
  });

  it('should exclude ambiguous characters (0, O, I, 1, L)', () => {
    const { plainCodes } = service.generate();
    const forbidden = new Set('0OIL1');
    for (const code of plainCodes) {
      for (const ch of code) {
        expect(forbidden.has(ch)).toBe(false);
      }
    }
  });

  it('should reject a code against the wrong hash', () => {
    const { plainCodes, hashedCodes } = service.generate();
    for (let i = 0; i < 10; i++) {
      const wrongIndex = (i + 1) % 10;
      expect(service.verify(plainCodes[i], hashedCodes[wrongIndex])).toBe(false);
    }
  });
});
