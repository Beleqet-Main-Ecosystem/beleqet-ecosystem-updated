import { CurrencyUtil } from '@/lib/currency';

describe('CurrencyUtil', () => {
  describe('float ↔ smallest unit', () => {
    it('converts decimal ETB input to Santim', () => {
      expect(CurrencyUtil.toSmallestUnit(120_000)).toBe(12_000_000);
      expect(CurrencyUtil.toSmallestUnit(120_000.5)).toBe(12_000_050);
      expect(CurrencyUtil.toSmallestUnit(0.01)).toBe(1);
    });

    it('converts decimal USD input to cents', () => {
      expect(CurrencyUtil.toSmallestUnit(50_000)).toBe(5_000_000);
      expect(CurrencyUtil.toSmallestUnit(11_925.0)).toBe(1_192_500);
      expect(CurrencyUtil.toSmallestUnit(0.99)).toBe(99);
    });

    it('rounds floating-point edges via Math.round', () => {
      expect(CurrencyUtil.toSmallestUnit(1.004)).toBe(100);
      expect(CurrencyUtil.toSmallestUnit(1.006)).toBe(101);
      expect(CurrencyUtil.toSmallestUnit(10.999)).toBe(1_100);
    });

    it('round-trips decimal → smallest → decimal', () => {
      const samples = [0, 0.01, 1, 99.99, 7_200, 120_000.5, 1_000_000];

      for (const decimal of samples) {
        const smallest = CurrencyUtil.toSmallestUnit(decimal);
        expect(Number.isInteger(smallest)).toBe(true);
        expect(CurrencyUtil.toDecimal(smallest)).toBeCloseTo(Math.round(decimal * 100) / 100, 2);
      }
    });

    it('throws on invalid toSmallestUnit input', () => {
      expect(() => CurrencyUtil.toSmallestUnit(NaN)).toThrow(/must be a number/i);
      expect(() => CurrencyUtil.toSmallestUnit('100' as unknown as number)).toThrow(
        /must be a number/i,
      );
    });

    it('throws on non-integer toDecimal input', () => {
      expect(() => CurrencyUtil.toDecimal(10.5)).toThrow(/integer/i);
      expect(() => CurrencyUtil.toDecimal(NaN)).toThrow(/integer/i);
    });
  });

  describe('format', () => {
    it('formats ETB Santim for en-US display', () => {
      const formatted = CurrencyUtil.format(12_000_000, 'ETB', 'en-US');
      expect(formatted).toContain('120,000.00');
      expect(formatted.toUpperCase()).toContain('ETB');
    });

    it('formats USD cents for en-US display', () => {
      const formatted = CurrencyUtil.format(5_000_000, 'USD', 'en-US');
      expect(formatted).toContain('50,000.00');
    });

    it('formats integer amounts from the API', () => {
      expect(CurrencyUtil.format(12_000_000, 'ETB')).toContain('120,000.00');
      expect(CurrencyUtil.format(2_454_000, 'ETB')).toContain('24,540.00');
      expect(CurrencyUtil.format(9_546_000, 'ETB')).toContain('95,460.00');
    });

    it('defaults currency to ETB when omitted', () => {
      const formatted = CurrencyUtil.format(100);
      expect(formatted.toUpperCase()).toContain('ETB');
    });
  });
});
