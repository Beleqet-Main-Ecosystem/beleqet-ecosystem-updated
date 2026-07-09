import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TwoFactorService } from './two-factor.service';
import { EncryptionService } from './encryption.service';
import { BackupCodeService } from './backup-code.service';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('JBSWY3DPEHPK3PXP'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/Test:user@test.com?secret=JBSWY3DPEHPK3PXP&issuer=Test'),
  generate: jest.fn().mockResolvedValue('123456'),
  verify: jest.fn().mockImplementation(({ secret, token }: { secret: string; token: string }) => {
    return Promise.resolve({ valid: token === '123456', delta: token === '123456' ? 0 : -1 });
  }),
}));

const _mockPrisma: Record<string, any> = {
  user: { findUnique: jest.fn() },
  userTwoFactor: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), delete: jest.fn(), deleteMany: jest.fn() },
  backupCode: { findMany: jest.fn(), createMany: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
  eventLog: { create: jest.fn() },
  $transaction: jest.fn((cb: (p: any) => any) => cb(_mockPrisma)),
};
const mockPrisma = _mockPrisma as any;

const mockConfig = {
  get: jest.fn((key: string, defaultValue?: any) => {
    const values: Record<string, any> = {
      TOTP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
      TOTP_TEMP_SECRET: 'test-temp-secret-0123456789abcdef0123456789abcdef',
      TOTP_ISSUER: 'TestApp',
      JWT_ACCESS_SECRET: 'test-jwt-secret',
    };
    return values[key] ?? defaultValue;
  }),
};

const mockJwt = {
  sign: jest.fn().mockReturnValue('signed-token'),
  verify: jest.fn().mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' }),
};

const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
};

describe('TwoFactorService', () => {
  let service: TwoFactorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TwoFactorService,
        EncryptionService,
        BackupCodeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: mockJwt },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    service = module.get<TwoFactorService>(TwoFactorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject construction without TOTP_TEMP_SECRET', () => {
    const badConfig = {
      get: jest.fn((key: string) => {
        if (key === 'TOTP_TEMP_SECRET') return undefined;
        return mockConfig.get(key);
      }),
    };
    expect(() => new TwoFactorService(
      mockRedis as any,
      mockPrisma as any,
      mockJwt as any,
      badConfig as any,
      new EncryptionService(mockConfig as any),
      new BackupCodeService(),
    )).toThrow('TOTP_TEMP_SECRET is required');
  });

  describe('startEnrollment', () => {
    it('should throw if 2FA already enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
      });
      await expect(service.startEnrollment('user-1')).rejects.toThrow(
        'Two-factor authentication is already enabled',
      );
    });

    it('should create a pending enrollment', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
      });
      mockPrisma.userTwoFactor.upsert.mockResolvedValue({});

      const result = await service.startEnrollment('user-1');
      expect(result).toHaveProperty('provisioningUri');
      expect(result).toHaveProperty('enrollmentToken');
      expect(result).toHaveProperty('secret');
      expect(result.provisioningUri).toContain('otpauth://');
    });
  });

  describe('verifyLogin', () => {
    it('should return false if 2FA not enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      const result = await service.verifyLogin('user-1', '123456');
      expect(result).toBe(false);
    });

    it('should return false for invalid code', async () => {
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');

      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });

      const result = await service.verifyLogin('user-1', '000000');
      expect(result).toBe(false);
    });

    it('should return true for valid code', async () => {
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');

      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });

      const result = await service.verifyLogin('user-1', '123456');
      expect(result).toBe(true);
    });

    it('should return false for replayed code', async () => {
      mockRedis.set.mockResolvedValue(null);

      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');

      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });

      const result = await service.verifyLogin('user-1', '123456');
      expect(result).toBe(false);
      expect(mockRedis.set).toHaveBeenCalledWith(
        expect.stringContaining('2fa:used:user-1:'),
        '1',
        'PX',
        90000,
        'NX',
      );
    });
  });

  describe('disable', () => {
    it('should throw if 2FA not enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      await expect(service.disable('user-1')).rejects.toThrow(
        'Two-factor authentication is not enabled',
      );
    });

    it('should delete the 2FA record', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        id: 'tf-1',
      });
      mockPrisma.userTwoFactor.delete.mockResolvedValue({});

      await service.disable('user-1');
      expect(mockPrisma.userTwoFactor.delete).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('regenerateBackupCodes', () => {
    it('should throw if 2FA not enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      await expect(service.regenerateBackupCodes('user-1')).rejects.toThrow(
        'Two-factor authentication is not enabled',
      );
    });
  });

  describe('cleanupExpiredEnrollments', () => {
    it('should delete expired enrollments', async () => {
      mockPrisma.userTwoFactor.deleteMany.mockResolvedValue({ count: 3 });
      const count = await service.cleanupExpiredEnrollments();
      expect(count).toBe(3);
      expect(mockPrisma.userTwoFactor.deleteMany).toHaveBeenCalledWith({
        where: {
          enabled: false,
          enrollmentExpiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });

  describe('confirmEnrollment', () => {
    it('should throw with invalid enrollment token', async () => {
      mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
      await expect(service.confirmEnrollment('user-1', 'bad-token', '123456'))
        .rejects.toThrow('Invalid or expired enrollment token');
    });

    it('should throw when no pending enrollment found', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      await expect(service.confirmEnrollment('user-1', 'token', '123456'))
        .rejects.toThrow('No pending enrollment found');
    });

    it('should throw if already enabled', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ enabled: true });
      await expect(service.confirmEnrollment('user-1', 'token', '123456'))
        .rejects.toThrow('Already enabled');
    });

    it('should throw with invalid code', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' });
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: false,
        secret: encrypted.ciphertext,
        id: 'tf-1',
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
      mockPrisma.backupCode.createMany.mockResolvedValue({ count: 10 });

      await expect(service.confirmEnrollment('user-1', 'token', '000000'))
        .rejects.toThrow('Invalid code');
    });

    it('should succeed with valid code', async () => {
      mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' });
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: false,
        secret: encrypted.ciphertext,
        id: 'tf-1',
      });
      mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
      mockPrisma.userTwoFactor.update.mockResolvedValue({});
      mockPrisma.backupCode.createMany.mockResolvedValue({ count: 10 });

      const result = await service.confirmEnrollment('user-1', 'token', '123456');
      expect(result.success).toBe(true);
      expect(result.backupCodes).toHaveLength(10);
    });
  });

  describe('verifyStepUp', () => {
    it('should throw if 2FA not enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      await expect(service.verifyStepUp('user-1', '123456'))
        .rejects.toThrow('Two-factor authentication is not enabled');
    });

    it('should throw with invalid code', async () => {
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });
      await expect(service.verifyStepUp('user-1', '000000'))
        .rejects.toThrow('Invalid code');
    });

    it('should return step-up token with valid code', async () => {
      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });
      mockPrisma.userTwoFactor.update.mockResolvedValue({});

      const token = await service.verifyStepUp('user-1', '123456');
      expect(typeof token).toBe('string');
      expect(mockJwt.sign).toHaveBeenCalled();
    });

    it('should throw for replayed code', async () => {
      mockRedis.set.mockResolvedValue(null);

      const encService = new EncryptionService(mockConfig as any);
      const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        secret: encrypted.ciphertext,
      });
      await expect(service.verifyStepUp('user-1', '123456'))
        .rejects.toThrow('This code has already been used');
    });
  });

  describe('verifyBackupCode', () => {
    it('should throw if 2FA not enabled', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      await expect(service.verifyBackupCode('user-1', 'CODE1234'))
        .rejects.toThrow('Two-factor authentication is not enabled');
    });

    it('should throw with invalid code', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        backupCodes: [
          { codeHash: '$2a$10$invalidhash', usedAt: null },
        ],
      });
      await expect(service.verifyBackupCode('user-1', 'WRONGCODE'))
        .rejects.toThrow('Invalid or already used backup code');
    });

    it('should consume a backup code and return remaining count', async () => {
      const bcService = new BackupCodeService();
      const { plainCodes, hashedCodes } = bcService.generate();

      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
        enabled: true,
        id: 'tf-1',
        backupCodes: [
          { id: 'bc-1', codeHash: hashedCodes[0], usedAt: null },
          { id: 'bc-2', codeHash: hashedCodes[1], usedAt: null },
        ],
      });
      mockPrisma.backupCode.update.mockResolvedValue({});

      const remaining = await service.verifyBackupCode('user-1', plainCodes[0]);
      expect(remaining).toBe(1);
      expect(mockPrisma.backupCode.update).toHaveBeenCalledWith({
        where: { id: 'bc-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  describe('generateTempToken', () => {
    it('should generate a temp token', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: 'tf-1' });
      const result = await service.generateTempToken('user-1');
      expect(result).toHaveProperty('tempToken');
      expect(result).toHaveProperty('factorId');
      expect(result.factorId).toBe('tf-1');
    });

    it('should handle missing 2FA record', async () => {
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      const result = await service.generateTempToken('user-1');
      expect(result.factorId).toBe('unknown');
    });
  });
});
