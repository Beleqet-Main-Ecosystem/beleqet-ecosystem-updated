import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CurrencyService, CurrencyCode } from './currency.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('convert', () => {
    it('should return same amount when currencies are identical', () => {
      const result = service.convert(100000, 'ETB', 'ETB');
      expect(result).toBe(100000);
    });

    it('should convert ETB to USD correctly', () => {
      const result = service.convert(140000, 'ETB', 'USD');
      expect(result).toBe(1000);
    });

    it('should convert USD to ETB correctly', () => {
      const result = service.convert(1000, 'USD', 'ETB');
      expect(result).toBe(140000);
    });

    it('should convert ETB to EUR correctly', () => {
      const result = service.convert(152000, 'ETB', 'EUR');
      expect(result).toBe(1000);
    });

    it('should return original amount if currency not found', () => {
      const result = service.convert(100000, 'ETB' as any, 'XYZ' as any);
      expect(result).toBe(100000);
    });
  });

  describe('convertSalaryPrediction', () => {
    it('should convert all salary fields correctly', () => {
      const prediction = {
        minSalary: 50000,
        maxSalary: 150000,
        averageSalary: 100000,
        medianSalary: 95000,
        currency: 'ETB',
        standardDeviation: 25000,
      };

      const result = service.convertSalaryPrediction(prediction, 'USD');

      expect(result.minSalary).toBe(357);
      expect(result.maxSalary).toBe(1071);
      expect(result.averageSalary).toBe(714);
      expect(result.medianSalary).toBe(679);
      expect(result.currency).toBe('USD');
    });

    it('should return unchanged prediction if currencies match', () => {
      const prediction = {
        minSalary: 50000,
        maxSalary: 150000,
        averageSalary: 100000,
        medianSalary: 95000,
        currency: 'ETB',
        standardDeviation: 25000,
      };

      const result = service.convertSalaryPrediction(prediction, 'ETB');

      expect(result.minSalary).toBe(50000);
      expect(result.currency).toBe('ETB');
    });
  });

  describe('getSupportedCurrencies', () => {
    it('should return array of supported currencies', () => {
      const currencies = service.getSupportedCurrencies();
      expect(currencies).toContain('ETB');
      expect(currencies).toContain('USD');
      expect(currencies).toContain('EUR');
      expect(currencies.length).toBeGreaterThan(0);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported currency', () => {
      expect(service.isSupported('ETB')).toBe(true);
      expect(service.isSupported('USD')).toBe(true);
    });

    it('should return false for unsupported currency', () => {
      expect(service.isSupported('XYZ')).toBe(false);
    });
  });

  describe('updateExchangeRates', () => {
    it('should update exchange rates', () => {
      const initialRate = service.getExchangeRate('USD');

      service.updateExchangeRates({ USD: 150 });

      const updatedRate = service.getExchangeRate('USD');
      expect(updatedRate).toBe(150);
    });
  });

  describe('getExchangeRate', () => {
    it('should return rate for known currency', () => {
      expect(service.getExchangeRate('USD')).toBe(140);
    });

    it('should return 1 for unknown currency', () => {
      expect(service.getExchangeRate('XYZ' as any)).toBe(1);
    });
  });
});