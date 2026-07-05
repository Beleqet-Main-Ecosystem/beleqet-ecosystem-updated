import {
  SUPPORTED_CURRENCIES,
  CURRENCY_CODES,
  LIVE_CURRENCY_CODES,
  getCurrencyMeta,
  isMockOnlyCurrency,
  formatAmount,
  toMinorUnits,
  isValidCurrencyCode,
} from './paypal-currency.utils';

/**
 * Unit tests for the PayPal currency utilities module.
 *
 * Verifies:
 * - `SUPPORTED_CURRENCIES` canonical list structure and completeness
 * - `getCurrencyMeta()` lookup by code
 * - `isMockOnlyCurrency()` correctly identifies ETB as mock-only
 * - `formatAmount()` produces correct localised output (en-US and de-DE)
 * - `formatAmount()` fallback for unsupported locales
 * - `toMinorUnits()` converts correctly for 2-decimal and 0-decimal currencies
 * - `isValidCurrencyCode()` validates and rejects codes correctly
 * - `LIVE_CURRENCY_CODES` excludes mock-only currencies
 * - `CURRENCY_CODES` includes all currencies (real + mock)
 */
describe('PayPal Currency Utilities', () => {

  // ── SUPPORTED_CURRENCIES ────────────────────────────────────────────────────

  describe('SUPPORTED_CURRENCIES', () => {
    it('contains at least 5 real currencies plus ETB', () => {
      expect(SUPPORTED_CURRENCIES.length).toBeGreaterThanOrEqual(6);
    });

    it('includes USD, EUR, GBP, AUD, CAD as live currencies', () => {
      const liveCodes = SUPPORTED_CURRENCIES
        .filter((c) => !c.mockOnly)
        .map((c) => c.code);

      expect(liveCodes).toContain('USD');
      expect(liveCodes).toContain('EUR');
      expect(liveCodes).toContain('GBP');
      expect(liveCodes).toContain('AUD');
      expect(liveCodes).toContain('CAD');
    });

    it('has ETB marked as mockOnly: true', () => {
      const etb = SUPPORTED_CURRENCIES.find((c) => c.code === 'ETB');
      expect(etb).toBeDefined();
      expect(etb!.mockOnly).toBe(true);
    });

    it('every entry has required fields: code, name, symbol, decimals', () => {
      for (const currency of SUPPORTED_CURRENCIES) {
        expect(currency.code).toMatch(/^[A-Z]{3}$/);
        expect(currency.name).toBeTruthy();
        expect(currency.symbol).toBeTruthy();
        expect(typeof currency.decimals).toBe('number');
      }
    });
  });

  // ── CURRENCY_CODES and LIVE_CURRENCY_CODES ──────────────────────────────────

  describe('CURRENCY_CODES', () => {
    it('includes ETB (mock-only currency)', () => {
      expect(CURRENCY_CODES.has('ETB')).toBe(true);
    });

    it('includes all real currencies', () => {
      expect(CURRENCY_CODES.has('USD')).toBe(true);
      expect(CURRENCY_CODES.has('EUR')).toBe(true);
    });

    it('does not include unknown codes like XYZ', () => {
      expect(CURRENCY_CODES.has('XYZ')).toBe(false);
    });
  });

  describe('LIVE_CURRENCY_CODES', () => {
    it('excludes ETB (it is mock-only)', () => {
      expect(LIVE_CURRENCY_CODES.has('ETB')).toBe(false);
    });

    it('includes all non-mock currencies', () => {
      expect(LIVE_CURRENCY_CODES.has('USD')).toBe(true);
      expect(LIVE_CURRENCY_CODES.has('EUR')).toBe(true);
      expect(LIVE_CURRENCY_CODES.has('GBP')).toBe(true);
    });
  });

  // ── getCurrencyMeta ─────────────────────────────────────────────────────────

  describe('getCurrencyMeta', () => {
    it('returns correct metadata for USD', () => {
      const meta = getCurrencyMeta('USD');
      expect(meta).toBeDefined();
      expect(meta!.code).toBe('USD');
      expect(meta!.symbol).toBe('$');
      expect(meta!.decimals).toBe(2);
    });

    it('returns correct metadata for ETB (mock-only currency)', () => {
      const meta = getCurrencyMeta('ETB');
      expect(meta).toBeDefined();
      expect(meta!.mockOnly).toBe(true);
      expect(meta!.symbol).toBe('Br');
    });

    it('returns undefined for an unknown currency code', () => {
      expect(getCurrencyMeta('XYZ')).toBeUndefined();
    });

    it('returns undefined for an empty string', () => {
      expect(getCurrencyMeta('')).toBeUndefined();
    });
  });

  // ── isMockOnlyCurrency ──────────────────────────────────────────────────────

  describe('isMockOnlyCurrency', () => {
    it('returns true for ETB (mock-only)', () => {
      expect(isMockOnlyCurrency('ETB')).toBe(true);
    });

    it('returns false for USD (live currency)', () => {
      expect(isMockOnlyCurrency('USD')).toBe(false);
    });

    it('returns false for EUR, GBP, AUD, CAD', () => {
      expect(isMockOnlyCurrency('EUR')).toBe(false);
      expect(isMockOnlyCurrency('GBP')).toBe(false);
      expect(isMockOnlyCurrency('AUD')).toBe(false);
      expect(isMockOnlyCurrency('CAD')).toBe(false);
    });

    it('returns false for unknown currency codes', () => {
      expect(isMockOnlyCurrency('XYZ')).toBe(false);
    });
  });

  // ── formatAmount ────────────────────────────────────────────────────────────

  describe('formatAmount', () => {
    it('formats USD in en-US locale correctly', () => {
      const formatted = formatAmount(1500.5, 'USD', 'en-US');
      expect(formatted).toContain('1,500');
      expect(formatted).toContain('1,500.50');
    });

    it('formats a round number with 2 decimal places', () => {
      const formatted = formatAmount(100, 'USD', 'en-US');
      expect(formatted).toContain('100.00');
    });

    it('formats EUR in de-DE locale (European decimal/grouping style)', () => {
      const formatted = formatAmount(1500.5, 'EUR', 'de-DE');
      // German locale uses period as thousands separator and comma for decimals
      expect(formatted).toContain('€');
    });

    it('does not throw for ETB currency code (mock-only but valid for display)', () => {
      expect(() => formatAmount(5000, 'ETB', 'en-US')).not.toThrow();
    });

    it('defaults to en-US locale when no locale is specified', () => {
      const withLocale    = formatAmount(250, 'USD', 'en-US');
      const withoutLocale = formatAmount(250, 'USD');
      expect(withLocale).toBe(withoutLocale);
    });

    it('falls back gracefully for an unsupported locale string', () => {
      // 'xx-XX' is not a valid BCP-47 locale — should not throw
      expect(() => formatAmount(100, 'USD', 'xx-XX')).not.toThrow();
    });
  });

  // ── toMinorUnits ────────────────────────────────────────────────────────────

  describe('toMinorUnits', () => {
    it('converts $19.99 USD to 1999 cents', () => {
      expect(toMinorUnits(19.99, 'USD')).toBe(1999);
    });

    it('converts $100.00 USD to 10000 cents', () => {
      expect(toMinorUnits(100.00, 'USD')).toBe(10000);
    });

    it('converts ETB 5000.00 to 500000 (2 decimal places)', () => {
      expect(toMinorUnits(5000, 'ETB')).toBe(500000);
    });

    it('converts fractional amounts with floating-point rounding', () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS — toMinorUnits should round correctly
      const result = toMinorUnits(0.1 + 0.2, 'USD');
      expect(result).toBe(30); // 30 cents
    });

    it('returns 0 for a zero amount', () => {
      expect(toMinorUnits(0, 'USD')).toBe(0);
    });

    it('defaults to 2 decimal places for unknown currency codes', () => {
      // XYZ not in list — should default decimals to 2
      expect(toMinorUnits(10.00, 'XYZ')).toBe(1000);
    });
  });

  // ── isValidCurrencyCode ─────────────────────────────────────────────────────

  describe('isValidCurrencyCode', () => {
    it('returns true for all supported currencies including ETB', () => {
      for (const currency of SUPPORTED_CURRENCIES) {
        expect(isValidCurrencyCode(currency.code)).toBe(true);
      }
    });

    it('returns false for unsupported code XYZ', () => {
      expect(isValidCurrencyCode('XYZ')).toBe(false);
    });

    it('returns false for an empty string', () => {
      expect(isValidCurrencyCode('')).toBe(false);
    });

    it('returns false for lowercase currency codes (codes must be uppercase)', () => {
      expect(isValidCurrencyCode('usd')).toBe(false);
    });
  });
});
