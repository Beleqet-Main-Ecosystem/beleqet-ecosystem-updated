import { describe, expect, it, beforeEach, jest } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let prisma: PrismaService;

  const mockPrismaService: any = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCurrencies', () => {
    it('should return all currencies', async () => {
      const result = await service.getCurrencies();

      expect(result).toEqual([
        { code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' },
        { code: 'EUR', name: 'Euro', symbol: '€' },
        { code: 'GBP', name: 'British Pound', symbol: '£' },
        { code: 'USD', name: 'US Dollar', symbol: '$' },
      ]);
    });
  });

  describe('getCurrencyByCode', () => {
    it('should return currency by code', async () => {
      const result = await service.getCurrencyByCode('USD');

      expect(result).toEqual({ code: 'USD', name: 'US Dollar', symbol: '$' });
    });

    it('should throw NotFoundException if currency not found', async () => {
      await expect(service.getCurrencyByCode('XXX')).rejects.toThrow(
        'Currency XXX not found',
      );
    });
  });

  describe('convertCurrency', () => {
    it('should convert currency correctly', async () => {
      jest.spyOn(service, 'getExchangeRate').mockResolvedValue(55.5);

      const result = await service.convertCurrency(100, 'USD', 'ETB');

      expect(result).toHaveProperty('amount', 100);
      expect(result).toHaveProperty('fromCurrency', 'USD');
      expect(result).toHaveProperty('toCurrency', 'ETB');
      expect(result).toHaveProperty('rate', 55.5);
      expect(result).toHaveProperty('convertedAmount', 5550);
    });

    it('should return same amount if same currency', async () => {
      const result = await service.convertCurrency(100, 'USD', 'USD');

      expect(result.amount).toBe(100);
      expect(result.rate).toBe(1);
      expect(result.convertedAmount).toBe(100);
    });
  });

  describe('formatCurrency', () => {
    it('should format currency correctly', async () => {
      const result = await service.formatCurrency(1000, 'ETB', 'en');

      expect(result).toContain('ETB');
      expect(result).toContain('1,000');
    });
  });

  describe('getUserCurrency', () => {
    it('should return user default currency', async () => {
      const mockUser = {
        id: 'user-1',
        currency: 'ETB',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserCurrency('user-1');

      expect(result).toEqual({ code: 'ETB', name: 'Ethiopian Birr', symbol: 'Br' });
    });

    it('should return default currency if user has no currency set', async () => {
      const mockUser = {
        id: 'user-1',
        currency: null,
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);

      const result = await service.getUserCurrency('user-1');

      expect(result).toHaveProperty('code', 'ETB');
      expect(result).toHaveProperty('symbol', 'Br');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.getUserCurrency('user-1')).rejects.toThrow(
        'User not found',
      );
    });
  });
});