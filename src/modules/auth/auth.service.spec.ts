import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { getQueueToken } from '@nestjs/bullmq';
import { UnauthorizedException, BadRequestException, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { AuthService } from './auth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TwoFactorService } from '../two-factor/two-factor.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

jest.mock('bcryptjs');

jest.mock('otplib', () => ({
  generateSecret: jest.fn().mockReturnValue('mocked-secret-key'),
  generateURI: jest.fn().mockReturnValue('otpauth://totp/mocked-uri'),
  verify: jest.fn().mockReturnValue(true),
}));

describe('AuthService', () => {
  let svc: AuthService;
  let prisma: any;
  let jwt: any;

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

  const mockTwoFactorSvc = {};
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
    prisma = module.get(PrismaService);
    jwt = module.get(JwtService);
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
        refreshToken: expect.any(String) // Gracefully matches the dynamic generated UUID v4
      });
      expect(mockPrisma.refreshToken.create).toHaveBeenCalled();
    });
  });
});