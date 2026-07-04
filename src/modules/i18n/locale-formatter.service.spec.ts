import { Test, TestingModule } from '@nestjs/testing';
import { LocaleFormatterService } from './locale-formatter.service';

describe('LocaleFormatterService', () => {
  let service: LocaleFormatterService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [LocaleFormatterService],
    }).compile();

    service = module.get<LocaleFormatterService>(LocaleFormatterService);
  });

  describe('formatNumber', () => {
    it('formats a number in English locale', () => {
      const result = service.formatNumber(1500.5, 'en');
      expect(result).toBe('1,500.5');
    });

    it('formats a number in French locale (uses space + comma)', () => {
      const result = service.formatNumber(1500.5, 'fr');
      // French uses non-breaking space as thousands separator and comma as decimal
      expect(result).toMatch(/1[\s\u00A0\u202F]500,5/);
    });

    it('falls back to en-US for unknown locale', () => {
      const result = service.formatNumber(1000, 'xx');
      expect(result).toBe('1,000');
    });
  });

  describe('formatCurrency', () => {
    it('formats ETB currency for Amharic locale', () => {
      const result = service.formatCurrency(500, 'am');
      expect(result).toContain('500');
      // Intl renders ETB as the Amharic symbol (ብር) or 'ETB' depending on runtime
      expect(result).toMatch(/ETB|ብር/);
    });

    it('formats USD when currency is explicitly overridden', () => {
      const result = service.formatCurrency(200, 'am', 'USD');
      expect(result).toContain('200');
      expect(result).toContain('$');
    });

    it('formats EUR for French locale', () => {
      const result = service.formatCurrency(100, 'fr');
      expect(result).toContain('100');
      expect(result).toMatch(/€|EUR/);
    });

    it('defaults to USD for unknown locale', () => {
      const result = service.formatCurrency(100, 'xx');
      expect(result).toContain('$');
    });
  });

  describe('formatDate', () => {
    const isoDate = '2025-07-10T00:00:00.000Z';

    it('formats a date string in English locale', () => {
      const result = service.formatDate(isoDate, 'en');
      expect(result).toMatch(/Jul|2025/);
    });

    it('formats a Date object in Arabic locale', () => {
      const result = service.formatDate(new Date(isoDate), 'ar');
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    });

    it('accepts Intl.DateTimeFormatOptions overrides', () => {
      const result = service.formatDate(isoDate, 'en', { dateStyle: 'full' });
      expect(result).toMatch(/2025/);
    });
  });
});
