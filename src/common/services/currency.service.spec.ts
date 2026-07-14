import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CurrencyService } from './currency.service';

describe('CurrencyService', () => {
  let svc: CurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: any) => {
              const map: Record<string, any> = {
                CURRENCY_CACHE_TTL_MINUTES: 60,
                RATE_USD_ETB: 120.5,
                RATE_EUR_ETB: 130.2,
                RATE_GBP_ETB: 152.0,
                RATE_KES_ETB: 0.93,
                RATE_NGN_ETB: 0.08,
                RATE_ZAR_ETB: 6.7,
                RATE_AED_ETB: 32.8,
                RATE_INR_ETB: 1.45,
                RATE_CAD_ETB: 88.5,
                RATE_AUD_ETB: 79.2,
                RATE_JPY_ETB: 0.81,
                RATE_CHF_ETB: 136.8,
                EXCHANGE_RATE_API_URL: undefined,
                EXCHANGE_RATE_API_KEY: undefined,
              };
              return map[key] ?? fallback;
            }),
          },
        },
      ],
    }).compile();
    svc = module.get<CurrencyService>(CurrencyService);
  });

  describe('getRatesSync', () => {
    it('should return fallback rates', () => {
      const rates = svc.getRatesSync();
      expect(rates['USD_ETB']).toBe(120.5);
      expect(rates['EUR_ETB']).toBe(130.2);
      expect(rates['GBP_ETB']).toBe(152.0);
    });

    it('should include inverse rates', () => {
      const rates = svc.getRatesSync();
      expect(rates['ETB_USD']).toBeDefined();
      expect(rates['ETB_EUR']).toBeDefined();
      expect(typeof rates['ETB_USD']).toBe('number');
    });

    it('should cache results', () => {
      const first = svc.getRatesSync();
      const second = svc.getRatesSync();
      expect(first).toBe(second);
    });
  });

  describe('getSupportedPairs', () => {
    it('should return sorted list of currencies', () => {
      const pairs = svc.getSupportedPairs();
      expect(pairs).toContain('USD');
      expect(pairs).toContain('EUR');
      expect(pairs).toContain('GBP');
      expect(pairs).toContain('ETB');
      expect(pairs).toEqual([...pairs].sort());
    });
  });

  describe('convert', () => {
    it('should return same amount for same currency', async () => {
      const result = await svc.convert(100, 'ETB', 'ETB');
      expect(result).toBe(100);
    });

    it('should convert USD to ETB', async () => {
      const result = await svc.convert(100, 'USD', 'ETB');
      expect(result).toBe(12050);
    });

    it('should convert ETB to USD', async () => {
      const result = await svc.convert(12050, 'ETB', 'USD');
      expect(result).toBe(100);
    });

    it('should throw BadRequestException for unsupported pair', async () => {
      await expect(svc.convert(100, 'XYZ', 'ETB')).rejects.toThrow(BadRequestException);
    });
  });

  describe('getRates (async)', () => {
    it('should return fallback rates when no API configured', async () => {
      const rates = await svc.getRates();
      expect(rates['USD_ETB']).toBe(120.5);
    });

    it('should cache async results', async () => {
      const first = await svc.getRates();
      const second = await svc.getRates();
      expect(first).toBe(second);
    });
  });
});
