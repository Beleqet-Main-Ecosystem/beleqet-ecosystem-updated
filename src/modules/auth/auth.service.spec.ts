import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bull';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorService } from '../two-factor/two-factor.service';

jest.mock('bcryptjs');

describe('AuthService', () => {
  let svc: AuthService;
  let prisma: any;
  let jwt: any;
  let config: any;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    userTwoFactor: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'TOTP_TEMP_SECRET') return 'test-temp-secret';
      if (key === 'JWT_ACCESS_SECRET') return 'test-access-secret';
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return fallback;
    }),
  };

  const mockTwoFactorSvc = {};
  const mockNotificationsQueue = { add: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: TwoFactorService, useValue: mockTwoFactorSvc },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
      ],
    }).compile();

    svc = module.get<AuthService>(AuthService);
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
    config = module.get(ConfigService);
  });

  const userId = 'user-1';
  const dto = { currentPassword: 'old-pass', newPassword: 'new-pass-123!' };

  describe('changePassword', () => {
    it('should change password without step-up when 2FA is not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');
      mockPrisma.user.update.mockResolvedValue({ id: userId });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await svc.changePassword(userId, dto);

      expect(result.success).toBe(true);
      expect(bcrypt.hash).toHaveBeenCalledWith('new-pass-123!', 12);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { passwordHash: 'hashed-new' } }),
      );
      expect(mockJwt.sign).not.toHaveBeenCalled();
    });

    it('should reject with requiresStepUp when 2FA is enabled and no step-up token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: '2fa-1', enabled: true, secret: 'encrypted' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwt.sign.mockReturnValue('challenge-token');

      await expect(svc.changePassword(userId, dto)).rejects.toThrow(UnauthorizedException);
      try {
        await svc.changePassword(userId, dto);
      } catch (e: any) {
        expect(e.response.requiresStepUp).toBe(true);
        expect(e.response.stepUpToken).toBe('challenge-token');
      }
    });

    it('should succeed with valid step-up token when 2FA is enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: '2fa-1', enabled: true, secret: 'encrypted' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-new');
      mockJwt.verify.mockReturnValue({
        sub: userId,
        purpose: '2fa_step_up',
        '2fa_verified_at': Math.floor(Date.now() / 1000),
      });
      mockPrisma.user.update.mockResolvedValue({ id: userId });
      mockPrisma.refreshToken.deleteMany.mockResolvedValue({ count: 0 });

      const result = await svc.changePassword(userId, dto, 'valid-step-up-token');

      expect(result.success).toBe(true);
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-step-up-token', { secret: 'test-temp-secret' });
    });

    it('should reject with wrong purpose in step-up token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: '2fa-1', enabled: true, secret: 'encrypted' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwt.verify.mockReturnValue({ sub: userId, purpose: '2fa_login', '2fa_verified_at': 9999999999 });

      await expect(svc.changePassword(userId, dto, 'wrong-purpose-token')).rejects.toThrow('Invalid step-up token purpose');
    });

    it('should reject expired step-up token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: '2fa-1', enabled: true, secret: 'encrypted' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockJwt.verify.mockReturnValue({
        sub: userId,
        purpose: '2fa_step_up',
        '2fa_verified_at': Math.floor(Date.now() / 1000) - 20 * 60,
      });

      await expect(svc.changePassword(userId, dto, 'expired-token')).rejects.toThrow(UnauthorizedException);
    });

    it('should reject when current password is wrong', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed-old' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(svc.changePassword(userId, dto)).rejects.toThrow(BadRequestException);
    });

    it('should reject for nonexistent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(svc.changePassword(userId, dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('changeEmail', () => {
    const emailDto = { newEmail: 'new@example.com', password: 'current-pass' };

    it('should change email without step-up when 2FA is not enabled', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, email: 'old@example.com', passwordHash: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      mockPrisma.user.update.mockResolvedValue({ id: userId });

      const result = await svc.changeEmail(userId, emailDto);

      expect(result.success).toBe(true);
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: 'new@example.com' }) }),
      );
    });

    it('should reject duplicate email', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ id: userId, passwordHash: 'hashed' })       // current user
        .mockResolvedValueOnce({ id: 'other-user', email: 'new@example.com' }); // existing conflicting
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);

      await expect(svc.changeEmail(userId, emailDto)).rejects.toThrow(ConflictException);
    });

    it('should reject wrong password', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: userId, passwordHash: 'hashed' });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(svc.changeEmail(userId, emailDto)).rejects.toThrow(BadRequestException);
    });
  });
});
