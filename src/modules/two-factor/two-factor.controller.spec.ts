import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { TwoFactorController } from './two-factor.controller';
import { TwoFactorService } from './two-factor.service';
import { EncryptionService } from './encryption.service';
import { BackupCodeService } from './backup-code.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
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
  userTwoFactor: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn(), delete: jest.fn() },
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
  verify: jest.fn().mockReturnValue({ sub: 'user-1', purpose: '2fa_login' }),
};

const mockAuthService = {
  issueTokens: jest.fn().mockResolvedValue({
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    user: { id: 'user-1', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'JOB_SEEKER' },
  }),
};

const mockRedis = {
  set: jest.fn().mockResolvedValue('OK'),
};

describe('TwoFactorController', () => {
  let controller: TwoFactorController;
  let svc: TwoFactorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.set.mockResolvedValue('OK');
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TwoFactorController],
      providers: [
        TwoFactorService,
        EncryptionService,
        BackupCodeService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: mockJwt },
        { provide: AuthService, useValue: mockAuthService },
        { provide: REDIS_CLIENT, useValue: mockRedis },
      ],
    }).compile();

    controller = module.get<TwoFactorController>(TwoFactorController);
    svc = module.get<TwoFactorService>(TwoFactorService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should start enrollment', async () => {
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'test@example.com',
    });
    mockPrisma.userTwoFactor.upsert.mockResolvedValue({});

    const result = await controller.startEnrollment({
      userId: 'user-1',
      email: 'test@example.com',
      role: 'JOB_SEEKER',
    });

    expect(result).toHaveProperty('provisioningUri');
    expect(result).toHaveProperty('enrollmentToken');
    expect(result).toHaveProperty('secret');
  });

  it('should confirm enrollment', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_enrollment' });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: false,
      id: 'tf-1',
      secret: (() => {
        const encService = new EncryptionService(mockConfig as any);
        return encService.encrypt('JBSWY3DPEHPK3PXP').ciphertext;
      })(),
    });
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));
    mockPrisma.userTwoFactor.update.mockResolvedValue({});
    mockPrisma.backupCode.createMany.mockResolvedValue({ count: 10 });

    const result = await controller.confirmEnrollment(
      { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' },
      { enrollmentToken: 'valid-token', code: '123456' },
    );
    expect(result.success).toBe(true);
    expect(result.backupCodes).toHaveLength(10);
  });

  it('should complete login via verify endpoint', async () => {
    const encService = new EncryptionService(mockConfig as any);
    const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
      secret: encrypted.ciphertext,
    });
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'JOB_SEEKER'
    });
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_login' });

    const result = await controller.verify({ tempToken: 'valid-token', code: '123456' });
    expect(result).toHaveProperty('accessToken');
    expect(mockAuthService.issueTokens).toHaveBeenCalled();
  });

  it('should throw on verify with invalid token', async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    await expect(controller.verify({ tempToken: 'bad-token', code: '123456' }))
      .rejects.toThrow('Invalid or expired verification token');
  });

  it('should throw on verify with wrong purpose', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: 'wrong_purpose' });
    await expect(controller.verify({ tempToken: 'token', code: '123456' }))
      .rejects.toThrow('Invalid token purpose');
  });

  it('should throw on verify with invalid code', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_login' });
    await expect(controller.verify({ tempToken: 'token', code: '000000' }))
      .rejects.toThrow('Invalid code');
  });

  it('should request an action-scoped challenge', async () => {
    mockJwt.sign.mockReturnValue('challenge-token');

    const result = await controller.requestChallenge(
      { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' },
      { action: 'wallet_withdraw', resourceId: 'wallet-123' },
    );
    expect(result).toHaveProperty('stepUpToken');
    expect(result.stepUpToken).toBe('challenge-token');
    expect(mockJwt.sign).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: '2fa_step_up_challenge',
        action: 'wallet_withdraw',
        resourceId: 'wallet-123',
      }),
      expect.any(Object),
    );
  });

  it('should complete step-up verification', async () => {
    const encService = new EncryptionService(mockConfig as any);
    const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
      secret: encrypted.ciphertext,
    });
    mockPrisma.userTwoFactor.update.mockResolvedValue({});
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_step_up_challenge' });

    const result = await controller.stepUp({ stepUpToken: 'challenge-token', code: '123456' });
    expect(result).toHaveProperty('stepUpToken');
  });

  it('should throw on step-up with wrong purpose', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_login' });
    await expect(controller.stepUp({ stepUpToken: 'wrong-purpose-token', code: '123456' }))
      .rejects.toThrow('Invalid token purpose');
  });

  it('should throw on step-up with action mismatch', async () => {
    mockJwt.verify.mockReturnValue({
      sub: 'user-1',
      purpose: '2fa_step_up_challenge',
      action: 'milestone_release',
      resourceId: 'milestone-1',
    });
    await expect(controller.stepUp({
      stepUpToken: 'scoped-token',
      code: '123456',
      action: 'wallet_withdraw',
    })).rejects.toThrow('Challenge token scoped to action "milestone_release"');
  });

  it('should throw on step-up with invalid token', async () => {
    mockJwt.verify.mockImplementation(() => { throw new Error('invalid'); });
    await expect(controller.stepUp({ stepUpToken: 'bad-token', code: '123456' }))
      .rejects.toThrow('Invalid or expired step-up token');
  });

  it('should complete login via backup code', async () => {
    const bcService = new BackupCodeService();
    const { plainCodes, hashedCodes } = bcService.generate();

    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_login' });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
      id: 'tf-1',
      backupCodes: [
        { id: 'bc-1', codeHash: hashedCodes[0], usedAt: null },
      ],
    });
    mockPrisma.backupCode.update.mockResolvedValue({});
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user-1', email: 'test@example.com', firstName: 'Test', lastName: 'User', role: 'JOB_SEEKER'
    });

    const result = await controller.backupCode({ tempToken: 'token', backupCode: plainCodes[0] });
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('remainingBackupCodes');
    expect((result as any).remainingBackupCodes).toBe(0);
  });

  it('should regenerate backup codes', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_step_up_challenge' });
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
      id: 'tf-1',
      secret: (() => {
        const encService = new EncryptionService(mockConfig as any);
        return encService.encrypt('JBSWY3DPEHPK3PXP').ciphertext;
      })(),
    });
    mockPrisma.userTwoFactor.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((cb: any) => cb(mockPrisma));

    const result = await controller.regenerateBackupCodes(
      { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' },
      { stepUpToken: 'token', code: '123456' },
    );
    expect(result).toHaveProperty('backupCodes');
  });

  it('should reject regenerate backup codes with wrong purpose', async () => {
    mockJwt.verify.mockReturnValue({ sub: 'user-1', purpose: '2fa_login' });
    await expect(controller.regenerateBackupCodes(
      { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' },
      { stepUpToken: 'wrong-token', code: '123456' },
    )).rejects.toThrow('Invalid token purpose');
  });

  it('should disable 2FA', async () => {
    const encService = new EncryptionService(mockConfig as any);
    const encrypted = encService.encrypt('JBSWY3DPEHPK3PXP');
    mockPrisma.userTwoFactor.findUnique.mockResolvedValue({
      enabled: true,
      secret: encrypted.ciphertext,
    });
    mockPrisma.userTwoFactor.delete.mockResolvedValue({});

    const result = await controller.disable(
      { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' },
      { code: '123456' },
    );
    expect(result.success).toBe(true);
  });
});
