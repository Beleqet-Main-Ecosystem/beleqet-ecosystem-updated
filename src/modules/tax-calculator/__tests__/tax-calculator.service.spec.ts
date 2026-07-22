import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TaxCurrency } from '../dto/calculate-tax.dto';
import { TaxCalculatorService } from '../tax-calculator.service';

describe('TaxCalculatorService', () => {
  let service: TaxCalculatorService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxCalculatorService],
    }).compile();

    service = module.get<TaxCalculatorService>(TaxCalculatorService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Ethiopia (ET) progressive brackets', () => {
    it('applies 0% within the annual exempt band (≤ 7,200 ETB)', () => {
      const result = service.calculate({
        grossIncome: 720_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(0);
      expect(result.effectiveTaxRate).toBe(0);
      expect(result.countryCode).toBe('ET');
      expect(result.currency).toBe(TaxCurrency.ETB);
    });

    it('taxes only the slice above 7,200 ETB at 10%', () => {
      const result = service.calculate({
        grossIncome: 720_100,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(10);
    });

    it('calculates tax at the top of the 10% annual band (19,800 ETB)', () => {
      const result = service.calculate({
        grossIncome: 1_980_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(126_000);
    });

    it('calculates tax at the top of the 15% annual band (38,400 ETB)', () => {
      const result = service.calculate({
        grossIncome: 3_840_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(405_000);
    });

    it('calculates tax at the top of the 20% annual band (63,000 ETB)', () => {
      const result = service.calculate({
        grossIncome: 6_300_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(897_000);
    });

    it('calculates tax at the top of the 25% annual band (93,600 ETB)', () => {
      const result = service.calculate({
        grossIncome: 9_360_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(1_662_000);
    });

    it('calculates tax at the top of the 30% annual band (130,800 ETB)', () => {
      const result = service.calculate({
        grossIncome: 13_080_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(2_778_000);
    });

    it('applies 35% on income above 130,800 ETB', () => {
      const result = service.calculate({
        grossIncome: 13_080_100,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(2_778_035);
    });

    it('calculates mid-band progressive tax for 120,000 ETB annual', () => {
      const result = service.calculate({
        grossIncome: 12_000_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(2_454_000);
      expect(result.netIncome).toBe(9_546_000);
    });

    it('calculates high-earner tax for 200,000 ETB annual', () => {
      const result = service.calculate({
        grossIncome: 20_000_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(5_200_000);
    });

    it('normalizes lowercase countryCode to ET', () => {
      const result = service.calculate({
        grossIncome: 720_000,
        currency: TaxCurrency.ETB,
        countryCode: 'et',
      });

      expect(result.countryCode).toBe('ET');
      expect(result.taxAmount).toBe(0);
    });
  });

  describe('United States (US) progressive brackets', () => {
    /**
     * TY 2024/2025 single-filer standard deduction: $14,600 = 1_460_000 cents.
     * taxableIncome = max(0, grossIncome − 1_460_000)
     * Brackets then apply to taxableIncome; effectiveTaxRate uses grossIncome.
     */
    it('returns zero tax when gross is at or below the $14,600 standard deduction', () => {
      const atDeduction = service.calculate({
        grossIncome: 1_460_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });
      expect(atDeduction.taxAmount).toBe(0);
      expect(atDeduction.netIncome).toBe(1_460_000);
      expect(atDeduction.effectiveTaxRate).toBe(0);
      expect(atDeduction.grossIncome).toBe(1_460_000);

      const belowDeduction = service.calculate({
        grossIncome: 1_192_500,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });
      expect(belowDeduction.taxAmount).toBe(0);
      expect(belowDeduction.netIncome).toBe(1_192_500);
      expect(belowDeduction.effectiveTaxRate).toBe(0);
      expect(belowDeduction.countryCode).toBe('US');
      expect(belowDeduction.currency).toBe(TaxCurrency.USD);
    });

    it('taxes only the amount above the standard deduction ($14,601)', () => {
      // taxable = 100 cents @ 10% → 10 cents tax
      const result = service.calculate({
        grossIncome: 1_460_100,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(10);
      expect(result.netIncome).toBe(1_460_090);
      expect(result.effectiveTaxRate).toBe(0.000007);
    });

    it('calculates tax at the top of the 12% band ($48,475) after deduction', () => {
      // taxable = 4_847_500 − 1_460_000 = 3_387_500 → tax 382_650
      const result = service.calculate({
        grossIncome: 4_847_500,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(382_650);
      expect(result.netIncome).toBe(4_464_850);
      expect(result.effectiveTaxRate).toBe(0.078938);
    });

    it('calculates progressive tax for $50,000 after deduction', () => {
      // taxable = 5_000_000 − 1_460_000 = 3_540_000 → tax 400_950
      const result = service.calculate({
        grossIncome: 5_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(400_950);
      expect(result.netIncome).toBe(4_599_050);
      expect(result.effectiveTaxRate).toBe(0.08019);
    });

    it('calculates progressive tax for $100,000 after deduction', () => {
      // taxable = 10_000_000 − 1_460_000 = 8_540_000 → tax 1_370_200
      const result = service.calculate({
        grossIncome: 10_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(1_370_200);
      expect(result.netIncome).toBe(8_629_800);
      expect(result.effectiveTaxRate).toBe(0.13702);
    });

    it('calculates progressive tax for $200,000 after deduction', () => {
      // taxable = 20_000_000 − 1_460_000 = 18_540_000 → tax 3_734_300
      const result = service.calculate({
        grossIncome: 20_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(3_734_300);
      expect(result.netIncome).toBe(16_265_700);
      expect(result.effectiveTaxRate).toBe(0.186715);
    });

    it('applies top 37% marginal rate for $700,000 after deduction', () => {
      // taxable = 70_000_000 − 1_460_000 = 68_540_000 → tax 21_061_825
      const result = service.calculate({
        grossIncome: 70_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(21_061_825);
      expect(result.netIncome).toBe(48_938_175);
      expect(result.effectiveTaxRate).toBe(0.300883);
    });

    it('uses grossIncome (not taxable income) for effectiveTaxRate', () => {
      const result = service.calculate({
        grossIncome: 5_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      const expectedRate =
        Number(
          (BigInt(result.taxAmount) * 1_000_000n + BigInt(result.grossIncome) / 2n) /
            BigInt(result.grossIncome),
        ) / 1_000_000;

      expect(result.taxAmount).toBe(400_950);
      expect(result.effectiveTaxRate).toBe(expectedRate);
      expect(result.effectiveTaxRate).toBe(0.08019);
      expect(result.grossIncome).toBe(5_000_000);
    });
  });

  describe('zero and negative income bounds', () => {
    it('returns zero tax and zero effective rate for zero ET income', () => {
      const result = service.calculate({
        grossIncome: 0,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.grossIncome).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.netIncome).toBe(0);
      expect(result.effectiveTaxRate).toBe(0);
    });

    it('returns zero tax and zero effective rate for zero US income', () => {
      const result = service.calculate({
        grossIncome: 0,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBe(0);
      expect(result.netIncome).toBe(0);
      expect(result.effectiveTaxRate).toBe(0);
    });

    it('treats negative income as non-taxable (defensive bound)', () => {
      const result = service.calculate({
        grossIncome: -100_00,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.taxAmount).toBe(0);
      expect(result.effectiveTaxRate).toBe(0);
      expect(result.netIncome).toBe(result.grossIncome - result.taxAmount);
    });
  });

  describe('mathematical consistency', () => {
    const fixtures = [
      { grossIncome: 0, currency: TaxCurrency.ETB, countryCode: 'ET' },
      { grossIncome: 720_000, currency: TaxCurrency.ETB, countryCode: 'ET' },
      { grossIncome: 12_000_000, currency: TaxCurrency.ETB, countryCode: 'ET' },
      { grossIncome: 20_000_000, currency: TaxCurrency.ETB, countryCode: 'ET' },
      { grossIncome: 5_000_000, currency: TaxCurrency.USD, countryCode: 'US' },
      { grossIncome: 10_000_000, currency: TaxCurrency.USD, countryCode: 'US' },
      { grossIncome: 70_000_000, currency: TaxCurrency.USD, countryCode: 'US' },
    ] as const;

    it.each(fixtures)(
      'ensures grossIncome - taxAmount === netIncome for $countryCode / $grossIncome',
      (dto) => {
        const result = service.calculate({ ...dto });

        expect(result.netIncome).toBe(result.grossIncome - result.taxAmount);
        expect(result.grossIncome).toBe(dto.grossIncome);
        expect(Number.isInteger(result.taxAmount)).toBe(true);
        expect(Number.isInteger(result.netIncome)).toBe(true);
      },
    );

    it('keeps effectiveTaxRate consistent with taxAmount / grossIncome', () => {
      const result = service.calculate({
        grossIncome: 12_000_000,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      const expectedRate =
        Number(
          (BigInt(result.taxAmount) * 1_000_000n + BigInt(result.grossIncome) / 2n) /
            BigInt(result.grossIncome),
        ) / 1_000_000;

      expect(result.effectiveTaxRate).toBe(expectedRate);
      expect(result.effectiveTaxRate).toBeGreaterThan(0);
      expect(result.effectiveTaxRate).toBeLessThan(1);
    });

    it('never returns a taxAmount greater than grossIncome for non-negative gross', () => {
      const result = service.calculate({
        grossIncome: 1_000_000,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.taxAmount).toBeLessThanOrEqual(result.grossIncome);
      expect(result.netIncome).toBeGreaterThanOrEqual(0);
    });
  });

  describe('unsupported jurisdictions', () => {
    it('throws BadRequestException for an unsupported countryCode', () => {
      expect(() =>
        service.calculate({
          grossIncome: 1_000_000,
          currency: TaxCurrency.USD,
          countryCode: 'XX',
        }),
      ).toThrow(BadRequestException);

      try {
        service.calculate({
          grossIncome: 1_000_000,
          currency: TaxCurrency.USD,
          countryCode: 'XX',
        });
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_UNSUPPORTED_JURISDICTION');
        expect(String(body.message)).toMatch(/Unsupported tax jurisdiction/);
      }
    });
  });

  describe('currency vs jurisdiction mismatch', () => {
    it('rejects ET with USD', () => {
      try {
        service.calculate({
          grossIncome: 1_000_000,
          currency: TaxCurrency.USD,
          countryCode: 'ET',
        });
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_CURRENCY_MISMATCH');
        expect(body.expectedCurrency).toBe('ETB');
      }
    });

    it('rejects US with ETB', () => {
      try {
        service.calculate({
          grossIncome: 1_000_000,
          currency: TaxCurrency.ETB,
          countryCode: 'US',
        });
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_CURRENCY_MISMATCH');
        expect(body.expectedCurrency).toBe('USD');
      }
    });
  });

  describe('floating-point grossIncome defense', () => {
    it('safely rounds near-integer floats before BigInt math', () => {
      const result = service.calculate({
        grossIncome: 12_000_000.4,
        currency: TaxCurrency.ETB,
        countryCode: 'ET',
      });

      expect(result.grossIncome).toBe(12_000_000);
      expect(Number.isInteger(result.taxAmount)).toBe(true);
      expect(result.netIncome).toBe(result.grossIncome - result.taxAmount);
    });

    it('rounds half-up style floats via Math.round', () => {
      const result = service.calculate({
        grossIncome: 5_000_000.6,
        currency: TaxCurrency.USD,
        countryCode: 'US',
      });

      expect(result.grossIncome).toBe(5_000_001);
      expect(Number.isInteger(result.taxAmount)).toBe(true);
    });

    it('rejects non-finite grossIncome', () => {
      try {
        service.calculate({
          grossIncome: Number.NaN,
          currency: TaxCurrency.ETB,
          countryCode: 'ET',
        });
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        const body = (error as BadRequestException).getResponse() as Record<string, unknown>;
        expect(body.errorCode).toBe('ERR_TAX_INVALID_GROSS_INCOME');
      }
    });
  });
});
