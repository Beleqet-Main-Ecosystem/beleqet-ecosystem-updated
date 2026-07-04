import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WalletService } from './wallet.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ExchangeRateService } from '../currency/exchange-rate.service';

interface MockPrismaWallet {
  freelancerWallet: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
  employerWallet: { findUnique: jest.Mock; create: jest.Mock };
  walletTransaction: { create: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
}

const mockPrisma = {
  freelancerWallet: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
  employerWallet: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  walletTransaction: {
    create: jest.fn(),
    update: jest.fn(),
  },
} as MockPrismaWallet;

mockPrisma.$transaction = jest.fn(async (arg: unknown) => {
  if (typeof arg === 'function') return (arg as (p: MockPrismaWallet) => unknown)(mockPrisma);
  return Promise.all(arg as Promise<unknown>[]);
});

const mockConfig = { get: jest.fn().mockReturnValue(undefined) };

const mockExchangeRateSvc = {
  convert: jest.fn(),
  getRate: jest.fn(),
  getSupportedCurrencies: jest.fn().mockReturnValue(['ETB', 'USD', 'EUR', 'GBP']),
};

describe('WalletService', () => {
  let service: WalletService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockConfig.get.mockReturnValue(undefined);
    mockPrisma.walletTransaction.create.mockResolvedValue({ id: 'tx-1' });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WalletService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: ExchangeRateService, useValue: mockExchangeRateSvc },
      ],
    }).compile();

    service = module.get<WalletService>(WalletService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('withdraw', () => {
    it('converts the requested currency into the wallet base currency and debits it', async () => {
      mockPrisma.freelancerWallet.findUnique.mockResolvedValue({ id: 'w-1', currency: 'ETB', availableBalance: 2000 });
      mockExchangeRateSvc.convert.mockResolvedValue(1205);

      const result = await service.withdraw('user-1', {
        amount: 10,
        method: 'CHAPA',
        accountRef: 'acct-1',
        currency: 'USD',
      });

      expect(mockExchangeRateSvc.convert).toHaveBeenCalledWith(10, 'USD', 'ETB');
      expect(mockPrisma.freelancerWallet.update).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { availableBalance: { decrement: 1205 } },
      });
      expect(result).toEqual({ success: true, amount: 10, method: 'CHAPA', note: expect.any(String) });
    });

    it('throws when the converted amount exceeds the available balance', async () => {
      mockPrisma.freelancerWallet.findUnique.mockResolvedValue({ id: 'w-1', currency: 'ETB', availableBalance: 1000 });
      mockExchangeRateSvc.convert.mockResolvedValue(1205);

      await expect(
        service.withdraw('user-1', { amount: 10, method: 'CHAPA', accountRef: 'acct-1', currency: 'USD' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getBalancesInCurrencies', () => {
    it('returns the wallet balance converted live into each requested currency', async () => {
      mockPrisma.freelancerWallet.upsert.mockResolvedValue({
        currency: 'ETB',
        availableBalance: 100,
        pendingBalance: 50,
      });
      mockExchangeRateSvc.convert.mockImplementation((amount: number) => Promise.resolve(amount * 2));

      const result = await service.getBalancesInCurrencies('user-1', ['ETB', 'USD']);

      expect(result).toEqual([
        { currency: 'ETB', availableBalance: 100, pendingBalance: 50 },
        { currency: 'USD', availableBalance: 200, pendingBalance: 100 },
      ]);
    });
  });

  describe('previewConvert', () => {
    it('returns the converted amount and rate without touching any balance', async () => {
      mockExchangeRateSvc.getRate.mockResolvedValue(120.5);

      const result = await service.previewConvert({ amount: 10, from: 'USD', to: 'ETB' });

      expect(result).toEqual({ amount: 10, from: 'USD', to: 'ETB', converted: 1205, rate: 120.5 });
      expect(mockPrisma.freelancerWallet.update).not.toHaveBeenCalled();
    });
  });
});