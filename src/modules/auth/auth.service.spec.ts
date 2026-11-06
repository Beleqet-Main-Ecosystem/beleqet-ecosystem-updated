import { createHmac } from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('bcryptjs');
jest.mock('../notifications/email-templates', () => ({
  ...jest.requireActual('../notifications/email-templates'),
  verificationEmail: jest.fn().mockResolvedValue({ html: '<p>verify</p>', text: 'verify' }),
  verificationCodeEmail: jest.fn().mockResolvedValue({ html: '<p>code</p>', text: 'code' }),
  welcomeEmail: jest.fn().mockResolvedValue({ html: '<p>welcome</p>', text: 'welcome' }),
}));

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('mocked-secret-key'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/mocked-uri'),
  verify: jest.fn().mockReturnValue(true),
}));

describe('AuthService', () => {
  let svc: AuthService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
    userTwoFactor: {
      findUnique: jest.fn(),
    },
    refreshToken: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      findMany: jest.fn(),
    },
    verificationToken: {
      create: jest.fn(),
      findFirst: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
    verify: jest.fn(),
  };

  const mockConfig = {
    get: jest.fn((key: string, fallback?: string) => {
      const values: Record<string, string> = {
        TOTP_TEMP_SECRET: 'test-temp-secret',
        JWT_ACCESS_SECRET: 'test-access-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_STEP_UP_SECRET: 'test-temp-secret',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return values[key] ?? fallback;
    }),
  };

  const mockTwoFactorSvc = {
    generateTempToken: jest.fn().mockResolvedValue({ tempToken: 'temp-1', factorId: 'f1' }),
  };
  const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }) };
  const mockEventEmitter = { emit: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.refreshToken.findMany.mockResolvedValue([]);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: TwoFactorService, useValue: mockTwoFactorSvc },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
        { provide: EventEmitter2, useValue: mockEventEmitter },
      ],
    }).compile();

    svc = module.get<AuthService>(AuthService);
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
    });
  });

  describe('resendVerification', () => {
    it('does nothing for a verified email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ emailVerified: true });
      await expect(svc.resendVerification(userId)).resolves.toEqual({
        success: true,
        alreadyVerified: true,
      });
      expect(mockPrisma.verificationToken.create).not.toHaveBeenCalled();
    });

    it('replaces old links and sends a new one', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce({ emailVerified: false })
        .mockResolvedValueOnce({ id: userId, email: 'a@b.c', firstName: 'A' });
      await svc.resendVerification(userId);
      expect(mockPrisma.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId, type: 'EMAIL_VERIFICATION' },
      });
      expect(mockPrisma.verificationToken.create).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('oauthSession', () => {
    const active = {
      id: userId,
      email: 'a@b.c',
      firstName: 'A',
      lastName: 'B',
      role: 'JOB_SEEKER',
      isActive: true,
    };

    it('refuses a disabled account', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...active, isActive: false });
      await expect(svc.oauthSession(userId)).rejects.toThrow('not active');
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('asks for the two-step code instead of issuing tokens', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(active);
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue({ id: 'f1' });
      await expect(svc.oauthSession(userId)).resolves.toEqual({
        requires2fa: true,
        tempToken: 'temp-1',
      });
      expect(mockPrisma.refreshToken.create).not.toHaveBeenCalled();
    });

    it('issues tokens when two-step sign-in is off', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(active);
      mockPrisma.userTwoFactor.findUnique.mockResolvedValue(null);
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt' });
      const result = await svc.oauthSession(userId);
      expect(result).toHaveProperty('accessToken');
    });
  });

  describe('issueTokensForUserId', () => {
    it('should generate and save tokens to the DB', async () => {
      // Mock the user query inside issueTokensForUserId
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        email: 'test@beleqet.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'JOB_SEEKER',
      });
      mockPrisma.refreshToken.create.mockResolvedValue({ id: 'rt-123' });
      mockJwt.sign.mockReturnValueOnce('signed-access').mockReturnValueOnce('signed-refresh');

      const result = await svc.issueTokensForUserId(userId);

      expect(result).toEqual({
        accessToken: 'signed-access',
        refreshToken: expect.any(String), // Gracefully matches the dynamic generated UUID v4
        user: {
          id: userId,
          email: 'test@beleqet.com',
          firstName: 'Test',
          lastName: 'User',
          role: 'JOB_SEEKER',
        },
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: userId },
        data: { lastLoginAt: expect.any(Date) },
      });
    });
  });

  describe('email code verification', () => {
    const SESSION = { accessToken: 'a', refreshToken: 'r', user: { id: 'u1' } };
    const codeKey = (id: string, code: string) =>
      `evc:${id}:${createHmac('sha256', 'test-temp-secret').update(`${id}:${code}`).digest('hex')}`;
    const sentCode = () => {
      const call = mockNotificationsQueue.add.mock.calls.find(([, job]) =>
        /verification code/.test(job.subject),
      );
      return call ? (call[1].subject as string).slice(0, 6) : null;
    };

    beforeEach(() => {
      mockPrisma.verificationToken.findFirst.mockResolvedValue(null);
      mockJwt.verify.mockReturnValue({ sub: 'u1', purpose: 'verify_email' });
    });

    it('sign-up emails a 6-digit code and returns a ticket instead of a session', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null);
      mockPrisma.user.create.mockResolvedValueOnce({
        id: 'u1',
        email: 'new@gmail.com',
        firstName: 'New',
        lastName: 'User',
        role: 'JOB_SEEKER',
      });

      const result = await svc.register({
        email: 'New@Gmail.com',
        password: 'Password123!',
        firstName: 'New',
        lastName: 'User',
      } as any);

      expect(result).toEqual({
        requiresEmailVerification: true,
        verificationToken: expect.any(String),
        email: 'new@gmail.com',
      });
      expect(result).not.toHaveProperty('accessToken');
      const code = sentCode();
      expect(code).toMatch(/^\d{6}$/);
      // Only a keyed hash of the code is stored.
      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            token: codeKey('u1', code!),
            type: 'EMAIL_VERIFICATION_CODE',
          }),
        }),
      );
    });

    it('sign-in asks a new, unconfirmed account for its code', async () => {
      const login = jest.spyOn(svc, 'login');
      const result = await svc.passwordLogin({
        id: 'u1',
        email: 'new@gmail.com',
        firstName: 'New',
        lastName: 'User',
        role: 'EMPLOYER',
        emailVerified: false,
        createdAt: new Date(),
      });
      expect(result).toMatchObject({ requiresEmailVerification: true });
      expect(login).not.toHaveBeenCalled();
    });

    it('sign-in works as before for older accounts, admins and Telegram sign-ups', async () => {
      const login = jest.spyOn(svc, 'login').mockResolvedValue(SESSION as any);
      const base = { id: 'u1', firstName: 'A', lastName: 'B', emailVerified: false };
      await svc.passwordLogin({
        ...base,
        email: 'old@gmail.com',
        role: 'JOB_SEEKER',
        createdAt: new Date('2026-03-01'),
      });
      await svc.passwordLogin({
        ...base,
        email: 'ops@beleqet.com',
        role: 'ADMIN',
        createdAt: new Date(),
      });
      await svc.passwordLogin({
        ...base,
        email: 'telegram_1@beleqet.internal',
        role: 'EMPLOYER',
        createdAt: new Date(),
      });
      await svc.passwordLogin({
        ...base,
        emailVerified: true,
        email: 'ok@gmail.com',
        role: 'EMPLOYER',
        createdAt: new Date(),
      });
      expect(login).toHaveBeenCalledTimes(4);
    });

    it('the right code confirms the email and signs the account in', async () => {
      mockPrisma.verificationToken.count.mockResolvedValueOnce(0);
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce({
        type: 'EMAIL_VERIFICATION_CODE',
        expiresAt: new Date(Date.now() + 60_000),
      });
      const session = jest.spyOn(svc, 'oauthSession').mockResolvedValue(SESSION as any);

      await expect(svc.verifyEmailCode('ticket', ' 123 456 ')).resolves.toEqual(SESSION);
      expect(mockPrisma.verificationToken.findUnique).toHaveBeenCalledWith({
        where: { token: codeKey('u1', '123456') },
      });
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'u1' },
        data: { emailVerified: true },
      });
      expect(session).toHaveBeenCalledWith('u1');
    });

    it('a wrong code is counted and refused', async () => {
      mockPrisma.verificationToken.count.mockResolvedValueOnce(1);
      mockPrisma.verificationToken.findUnique.mockResolvedValueOnce(null);

      await expect(svc.verifyEmailCode('ticket', '000000')).rejects.toThrow(
        'not right or has expired',
      );
      expect(mockPrisma.verificationToken.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ type: 'EMAIL_VERIFICATION_CODE_ATTEMPT' }),
        }),
      );
      expect(mockPrisma.user.update).not.toHaveBeenCalled();
    });

    it('stops after five wrong codes until a new code is sent', async () => {
      mockPrisma.verificationToken.count.mockResolvedValueOnce(5);
      await expect(svc.verifyEmailCode('ticket', '123456')).rejects.toThrow('Too many wrong codes');
      expect(mockPrisma.verificationToken.findUnique).not.toHaveBeenCalled();
    });

    it('refuses a malformed code or an expired ticket', async () => {
      await expect(svc.verifyEmailCode('ticket', '12ab')).rejects.toThrow('6-digit code');
      mockJwt.verify.mockImplementationOnce(() => {
        throw new Error('jwt expired');
      });
      await expect(svc.verifyEmailCode('old', '123456')).rejects.toThrow('expired');
    });

    it('sends a new code at most once a minute', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'u1',
        email: 'new@gmail.com',
        firstName: 'New',
        emailVerified: false,
      });
      mockPrisma.verificationToken.findFirst.mockResolvedValueOnce({ id: 'recent' });
      await expect(svc.resendEmailCode('ticket')).resolves.toEqual({
        sent: false,
        alreadyVerified: false,
      });
      await expect(svc.resendEmailCode('ticket')).resolves.toEqual({
        sent: true,
        alreadyVerified: false,
      });
      expect(sentCode()).toMatch(/^\d{6}$/);
    });
  });
});
