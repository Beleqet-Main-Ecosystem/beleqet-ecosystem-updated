import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TelegramTmaService } from './telegram-tma.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

describe('TelegramTmaService', () => {
  let service: TelegramTmaService;

  const mockToken = '123456:SECRET_TEST_BOT_TOKEN_XYZ';

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockAuthService = {
    issueTokensForUserId: jest.fn().mockResolvedValue({
      accessToken: 'jwt-access-token',
      refreshToken: 'jwt-refresh-token',
      user: { id: 'usr-100', email: 'test@tme.beleqet.local', role: 'JOB_SEEKER' },
    }),
  };

  const mockConfig = {
    get: jest.fn((key: string) => {
      if (key === 'TELEGRAM_BOT_TOKEN') return mockToken;
      return undefined;
    }),
  };

  function generateTestInitData(
    userObj: any,
    authDateSec: number,
    secretToken = mockToken,
  ): string {
    const params = new URLSearchParams();
    params.set('query_id', 'AAE_QUERY_ID_TEST');
    params.set('user', JSON.stringify(userObj));
    params.set('auth_date', String(authDateSec));

    const entries = Array.from(params.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

    const secret = crypto.createHmac('sha256', 'WebAppData').update(secretToken).digest();
    const hash = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

    params.set('hash', hash);
    return params.toString();
  }

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TelegramTmaService,
        { provide: ConfigService, useValue: mockConfig },
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AuthService, useValue: mockAuthService },
      ],
    }).compile();

    service = module.get<TelegramTmaService>(TelegramTmaService);
  });

  describe('verifyInitData', () => {
    const testUser = { id: 998877, first_name: 'Abebe', username: 'abebi' };
    const nowSec = Math.floor(Date.now() / 1000) - 60; // 1 min ago

    it('successfully verifies a valid initData string and returns user payload', () => {
      const initData = generateTestInitData(testUser, nowSec);
      const result = service.verifyInitData(initData);
      expect(result.id).toBe(998877);
      expect(result.first_name).toBe('Abebe');
    });

    it('throws UnauthorizedException if hash is modified/invalid', () => {
      let initData = generateTestInitData(testUser, nowSec);
      initData = initData.replace(
        /hash=[a-f0-9]+/,
        'hash=0000000000000000000000000000000000000000000000000000000000000000',
      );
      expect(() => service.verifyInitData(initData)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException if auth_date is older than 24 hours', () => {
      const expiredSec = Math.floor(Date.now() / 1000) - 90000; // > 24 hours
      const initData = generateTestInitData(testUser, expiredSec);
      expect(() => service.verifyInitData(initData)).toThrow(
        'Telegram WebApp authentication data has expired.',
      );
    });

    it('throws UnauthorizedException if TELEGRAM_BOT_TOKEN is missing', async () => {
      const emptyConfig = { get: jest.fn().mockReturnValue('') };
      const testModule = await Test.createTestingModule({
        providers: [
          TelegramTmaService,
          { provide: ConfigService, useValue: emptyConfig },
          { provide: PrismaService, useValue: mockPrisma },
          { provide: AuthService, useValue: mockAuthService },
        ],
      }).compile();
      const noTokenService = testModule.get<TelegramTmaService>(TelegramTmaService);
      const initData = generateTestInitData(testUser, nowSec);
      expect(() => noTokenService.verifyInitData(initData)).toThrow(
        'Telegram Bot Token is not properly configured.',
      );
    });
  });

  describe('authenticateTmaUser', () => {
    const testUser = { id: 555444, first_name: 'Sara', last_name: 'T' };
    const nowSec = Math.floor(Date.now() / 1000) - 10;
    let initData: string;

    beforeEach(() => {
      initData = generateTestInitData(testUser, nowSec);
    });

    it('logs in an existing active user matched by telegramId', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({
        id: 'usr-existing-1',
        isActive: true,
      } as any);

      const result = await service.authenticateTmaUser(initData);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '555444' },
        select: expect.any(Object),
      });
      expect(mockAuthService.issueTokensForUserId).toHaveBeenCalledWith('usr-existing-1');
      expect(result.accessToken).toBe('jwt-access-token');
    });

    it('provisions a new user account if telegramId does not exist in db', async () => {
      mockPrisma.user.findUnique
        .mockResolvedValueOnce(null) // Not found by telegramId
        .mockResolvedValueOnce(null); // Not found by synthetic email

      mockPrisma.user.create.mockResolvedValueOnce({ id: 'usr-new-created' } as any);

      const result = await service.authenticateTmaUser(initData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'tma_555444@tme.beleqet.local',
          firstName: 'Sara',
          lastName: 'T',
          avatarUrl: null,
          telegramId: '555444',
          emailVerified: true,
          role: 'JOB_SEEKER',
          wallet: { create: {} },
        },
        select: { id: true },
      });
      expect(mockAuthService.issueTokensForUserId).toHaveBeenCalledWith('usr-new-created');
      expect(result.accessToken).toBe('jwt-access-token');
    });

    it('provisions a new EMPLOYER account with an employer wallet when preferred role is specified', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

      mockPrisma.user.create.mockResolvedValueOnce({ id: 'usr-employer-created' } as any);

      const result = await service.authenticateTmaUser(initData, 'EMPLOYER');

      expect(mockPrisma.user.create).toHaveBeenCalledWith({
        data: {
          email: 'tma_555444@tme.beleqet.local',
          firstName: 'Sara',
          lastName: 'T',
          avatarUrl: null,
          telegramId: '555444',
          emailVerified: true,
          role: 'EMPLOYER',
          employerWallet: { create: { balance: 0, lockedBalance: 0 } },
        },
        select: { id: true },
      });
      expect(mockAuthService.issueTokensForUserId).toHaveBeenCalledWith('usr-employer-created');
      expect(result.accessToken).toBe('jwt-access-token');
    });
  });

  describe('linkTelegramAccount', () => {
    const testUser = { id: 777888, first_name: 'Dawson' };
    const nowSec = Math.floor(Date.now() / 1000) - 5;

    it('links a verified telegramId to an existing user session', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce(null); // not claimed by anyone else
      mockPrisma.user.update.mockResolvedValueOnce({
        id: 'usr-session-2',
        telegramId: '777888',
      } as any);

      const initData = generateTestInitData(testUser, nowSec);
      const res = await service.linkTelegramAccount('usr-session-2', initData);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: 'usr-session-2' },
        data: { telegramId: '777888' },
      });
      expect(res.success).toBe(true);
      expect(res.telegramId).toBe('777888');
    });

    it('throws ConflictException if telegramId is already linked to another user', async () => {
      mockPrisma.user.findUnique.mockResolvedValueOnce({ id: 'some-other-user-id' } as any);
      const initData = generateTestInitData(testUser, nowSec);

      await expect(service.linkTelegramAccount('usr-session-2', initData)).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
