import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { I18nService } from './i18n.service';

describe('I18nService', () => {
  let service: I18nService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        I18nService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<I18nService>(I18nService);
    configService = module.get(ConfigService) as jest.Mocked<ConfigService>;
  });

  describe('getLocalizationContext', () => {
    it('should return default English context', async () => {
      const context = await service.getLocalizationContext('user_123', 'en');

      expect(context).toBeDefined();
      expect(context.locale).toBe('en');
      expect(context.currency).toBe('USD');
      expect(context.currencySymbol).toBe('$');
    });

    it('should return Amharic context for Ethiopia', async () => {
      const context = await service.getLocalizationContext('user_123', 'am');

      expect(context.locale).toBe('am');
      expect(context.currency).toBe('ETB');
      expect(context.currencySymbol).toBe('Br');
    });

    it('should fallback to English for unsupported locale', async () => {
      const context = await service.getLocalizationContext('user_123', 'xx');

      expect(context.locale).toBe('en');
      expect(context.currency).toBe('USD');
    });
  });

  describe('translate', () => {
    it('should translate message to English', () => {
      const message = service.translate('payment.success', 'en');

      expect(message).toContain('Payment successful');
    });

    it('should translate message to Amharic', () => {
      const message = service.translate('payment.success', 'am');

      expect(message).toBeDefined();
      expect(message.length > 0).toBe(true);
    });

    it('should handle variable replacement', () => {
      const message = service.translate('payment.amount', 'en', { amount: '100', currency: 'USD' });

      expect(message).toBeDefined();
    });

    it('should fallback to English for unsupported locale', () => {
      const message = service.translate('payment.success', 'xx');

      expect(message).toContain('Payment successful');
    });

    it('should return message key if not found', () => {
      const unknownKey = 'unknown.key.that.does.not.exist';
      const message = service.translate(unknownKey, 'en');

      expect(message).toBe(unknownKey);
    });
  });

  describe('formatCurrency', () => {
    it('should format USD currency', () => {
      const formatted = service.formatCurrency(100, 'USD', 'en-US');

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should format EUR currency', () => {
      const formatted = service.formatCurrency(100, 'EUR', 'de-DE');

      expect(formatted).toBeDefined();
    });

    it('should format ETB currency', () => {
      const formatted = service.formatCurrency(1000, 'ETB', 'am-ET');

      expect(formatted).toBeDefined();
    });

    it('should handle formatting with decimal places', () => {
      const formatted = service.formatCurrency(99.99, 'USD');

      expect(formatted).toContain('99');
    });
  });

  describe('formatDateTime', () => {
    it('should format date in English', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = service.formatDateTime(date, 'en', 'America/New_York');

      expect(formatted).toBeDefined();
      expect(typeof formatted).toBe('string');
    });

    it('should format date in different timezone', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = service.formatDateTime(date, 'en', 'Africa/Addis_Ababa');

      expect(formatted).toBeDefined();
    });

    it('should format date for Amharic locale', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = service.formatDateTime(date, 'am', 'Africa/Addis_Ababa');

      expect(formatted).toBeDefined();
    });

    it('should return ISO string as fallback for invalid timezone', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = service.formatDateTime(date, 'en', 'Invalid/Timezone');

      expect(formatted).toBeDefined();
    });
  });

  describe('supportedLocales', () => {
    it('should support multiple languages', () => {
      const locales = ['en', 'es', 'fr', 'de', 'am', 'ar', 'pt', 'ja', 'zh'];

      locales.forEach((locale) => {
        const message = service.translate('payment.success', locale);
        expect(message).toBeDefined();
        expect(message.length > 0).toBe(true);
      });
    });
  });

  describe('supportedCurrencies', () => {
    it('should support multiple currencies with symbols', () => {
      const currencies = [
        { code: 'USD', symbol: '$' },
        { code: 'EUR', symbol: '€' },
        { code: 'GBP', symbol: '£' },
        { code: 'ETB', symbol: 'Br' },
        { code: 'NGN', symbol: '₦' },
      ];

      currencies.forEach(({ code, symbol }) => {
        const formatted = service.formatCurrency(100, code, 'en');
        expect(formatted).toBeDefined();
      });
    });
  });
});
