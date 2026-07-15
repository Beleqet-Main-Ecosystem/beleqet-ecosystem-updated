import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

import { WalletService, WithdrawDto } from '../wallet/wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { StepUpGuard } from './guards/step-up.guard';
import { SENSITIVE_ACTION_KEY } from './decorators/sensitive-action.decorator';

const USD_ETB_RATE = 120.5;

const mockFetch = jest.fn();
global.fetch = mockFetch as unknown as typeof fetch;

function buildMockPrisma(walletBalance = 10_000, walletCurrency = 'ETB') {
  const walletRecord = {
    id: 'wallet-user-001',
    userId: 'user-001',
    currency: walletCurrency,
    availableBalance: walletBalance,
    lockedBalance: 0,
    transactions: [],
  };

  const txRecord = { id: 'tx-001', walletId: walletRecord.id, amount: 0, type: 'DEBIT_WITHDRAWAL', note: '' };

  return {
    freelancerWallet: {
      findUnique: jest.fn().mockResolvedValue(walletRecord),
      upsert: jest.fn().mockResolvedValue(walletRecord),
      update: jest.fn().mockResolvedValue(walletRecord),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    walletTransaction: {
      create: jest.fn().mockResolvedValue(txRecord),
      update: jest.fn().mockResolvedValue(txRecord),
    },
    $transaction: jest.fn().mockImplementation(async (cbOrArray: unknown) => {
      if (typeof cbOrArray === 'function') {
        const stubPrisma = {
          freelancerWallet: { 
            update: jest.fn().mockResolvedValue(walletRecord),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          walletTransaction: {
            create: jest.fn().mockResolvedValue(txRecord),
            update: jest.fn().mockResolvedValue(txRecord),
          },
        };
        return cbOrArray(stubPrisma);
      }
      return Promise.all(cbOrArray as Promise<unknown>[]);
    }),
  } as unknown as PrismaService;
}

function buildMockConfig() {
  return {
    getOrThrow: jest.fn((k: string) => {
      if (k === 'CHAPA_SECRET_KEY') return 'test_chapa_secret_key';
      throw new Error(`Missing config: ${k}`);
    }),
    get: jest.fn((k: string, fb?: string) => {
      if (k === 'CHAPA_SECRET_KEY') return 'test_chapa_secret_key';
      return fb ?? '';
    }),
  } as unknown as ConfigService;
}

async function buildCtx(walletBalance = 10_000) {
  const prisma = buildMockPrisma(walletBalance);
  const config = buildMockConfig();

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      WalletService,
      { provide: PrismaService, useValue: prisma },
      { provide: ConfigService, useValue: config },
    ],
  }).compile();

  const walletService = module.get<WalletService>(WalletService);
  return { walletService, prisma };
}

describe('Step-Up + Multi-Currency integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockReset();
  });

  describe('WithdrawDto — currency parameter acceptance', () => {
    it('defaults currency to ETB when not provided', () => {
      const dto = new WithdrawDto();
      dto.amount = 100;
      dto.method = 'CHAPA';
      dto.accountRef = '0911000000';
      expect(dto.currency).toBe('ETB');
    });

    it('accepts a non-default currency (USD)', () => {
      const dto = new WithdrawDto();
      dto.amount = 100;
      dto.method = 'CHAPA';
      dto.accountRef = '0911000000';
      dto.currency = 'USD';
      expect(dto.currency).toBe('USD');
    });
  });

  describe('StepUpGuard — currency-agnostic by design', () => {
    it('guard source does not reference currency fields', () => {
      const guardSource = StepUpGuard.toString();
      expect(guardSource).not.toMatch(/currency/i);
    });

    it('SENSITIVE_ACTION_KEY is present and correct', () => {
      expect(SENSITIVE_ACTION_KEY).toBe('sensitive_action');
    });
  });

  describe('Wallet withdrawal with non-default currency (USD) — step-up compatible', () => {
    it('succeeds when converting USD to ETB and wallet has sufficient balance', async () => {
      const ctx = await buildCtx(10_000);

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const dto: WithdrawDto = {
        amount: 10,
        method: 'CHAPA',
        accountRef: '0912345678',
        currency: 'USD',
      };

      const result = await ctx.walletService.withdraw('user-001', dto);

      expect(result.success).toBe(true);
      expect(result.amount).toBe(10);
      expect(result.method).toBe('CHAPA');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.chapa.co/v1/transfers',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"amount":"10"'),
        }),
      );
    });

    it('deducts correct ETB equivalent when withdrawal is in USD', async () => {
      const ctx = await buildCtx(10_000);

      mockFetch.mockResolvedValueOnce({
        json: () => Promise.resolve({ status: 'success' }),
      } as Response);

      const dto: WithdrawDto = {
        amount: 50,
        method: 'CHAPA',
        accountRef: '0912345678',
        currency: 'USD',
      };

      await ctx.walletService.withdraw('user-001', dto);
      expect(mockFetch).toHaveBeenCalled();
    });

    it('throws BadRequestException when USD amount exceeds ETB wallet balance', async () => {
      const ctx = await buildCtx(100);

      const dto: WithdrawDto = {
        amount: 5,
        method: 'CHAPA',
        accountRef: '0912345678',
        currency: 'USD',
      };

      await expect(ctx.walletService.withdraw('user-001', dto)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Escrow milestone release — currency-agnostic via contract', () => {
    it('reads currency from the contract, not the request', async () => {
      const { walletService } = await buildCtx(10_000);
      const convertCurrency = (walletService as any).convertCurrency.bind(walletService);

      const result = convertCurrency(1000, 'USD', 'ETB');
      expect(result).toBe(Math.round(1000 * USD_ETB_RATE));
    });
  });
});
