import { BadRequestException, Injectable } from '@nestjs/common';
import { CalculateTaxDto, TaxCalculationResult, TaxCurrency } from './dto/calculate-tax.dto';

interface TaxBracket {
  upToExclusive: number | null;
  rateBps: number;
}

const SMALLEST_UNITS_PER_MAJOR = 100;
const MONTHS_PER_YEAR = 12;

/** IRS TY 2024/2025 standard deduction for a single filer ($14,600). */
const US_STANDARD_DEDUCTION_SINGLE_CENTS = 1_460_000;

const EXPECTED_CURRENCY: Record<'ET' | 'US', TaxCurrency> = {
  ET: TaxCurrency.ETB,
  US: TaxCurrency.USD,
};

@Injectable()
export class TaxCalculatorService {
  private static readonly ET_MONTHLY_BRACKETS_MAJOR: ReadonlyArray<{
    upToExclusive: number | null;
    rateBps: number;
  }> = [
    { upToExclusive: 600, rateBps: 0 },
    { upToExclusive: 1_650, rateBps: 1_000 },
    { upToExclusive: 3_200, rateBps: 1_500 },
    { upToExclusive: 5_250, rateBps: 2_000 },
    { upToExclusive: 7_800, rateBps: 2_500 },
    { upToExclusive: 10_900, rateBps: 3_000 },
    { upToExclusive: null, rateBps: 3_500 },
  ];

  private static readonly US_FEDERAL_SINGLE_BRACKETS_MAJOR: ReadonlyArray<{
    upToExclusive: number | null;
    rateBps: number;
  }> = [
    { upToExclusive: 11_925, rateBps: 1_000 },
    { upToExclusive: 48_475, rateBps: 1_200 },
    { upToExclusive: 103_350, rateBps: 2_200 },
    { upToExclusive: 197_300, rateBps: 2_400 },
    { upToExclusive: 250_525, rateBps: 3_200 },
    { upToExclusive: 626_350, rateBps: 3_500 },
    { upToExclusive: null, rateBps: 3_700 },
  ];

  calculate(dto: CalculateTaxDto): TaxCalculationResult {
    const { currency, countryCode } = dto;
    const code = countryCode.toUpperCase();

    this.assertCurrencyMatchesJurisdiction(code, currency);
    const grossIncome = this.normalizeGrossIncome(dto.grossIncome);

    let taxAmount: number;

    switch (code) {
      case 'ET':
        taxAmount = this.calculateEthiopianTax(grossIncome);
        break;
      case 'US':
        taxAmount = this.calculateUnitedStatesTax(grossIncome);
        break;
      default:
        throw new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
          message: `Unsupported tax jurisdiction "${countryCode}". Supported: ET, US.`,
          countryCode: code,
        });
    }

    const netIncome = grossIncome - taxAmount;
    const effectiveTaxRate = this.computeEffectiveRate(grossIncome, taxAmount);

    return {
      grossIncome,
      taxAmount,
      netIncome,
      currency,
      countryCode: code,
      effectiveTaxRate,
    };
  }

  private assertCurrencyMatchesJurisdiction(countryCode: string, currency: TaxCurrency): void {
    if (countryCode !== 'ET' && countryCode !== 'US') {
      return;
    }

    const expected = EXPECTED_CURRENCY[countryCode];
    if (currency !== expected) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
        message: `Currency "${currency}" does not match jurisdiction "${countryCode}". Expected ${expected}.`,
        countryCode,
        currency,
        expectedCurrency: expected,
      });
    }
  }

  private normalizeGrossIncome(grossIncome: number): number {
    if (typeof grossIncome !== 'number' || !Number.isFinite(grossIncome)) {
      throw new BadRequestException({
        statusCode: 400,
        errorCode: 'ERR_TAX_INVALID_GROSS_INCOME',
        message: 'grossIncome must be a finite number in smallest currency units.',
      });
    }

    if (Number.isInteger(grossIncome)) {
      return grossIncome;
    }

    return Math.round(grossIncome);
  }

  private calculateEthiopianTax(annualSantim: number): number {
    const brackets = this.toSmallestUnitBrackets(
      TaxCalculatorService.ET_MONTHLY_BRACKETS_MAJOR,
      MONTHS_PER_YEAR,
    );
    return this.applyProgressiveBrackets(annualSantim, brackets);
  }

  private calculateUnitedStatesTax(annualCents: number): number {
    const taxableIncome = annualCents - US_STANDARD_DEDUCTION_SINGLE_CENTS;
    if (taxableIncome <= 0) {
      return 0;
    }

    const brackets = this.toSmallestUnitBrackets(
      TaxCalculatorService.US_FEDERAL_SINGLE_BRACKETS_MAJOR,
      1,
    );
    return this.applyProgressiveBrackets(taxableIncome, brackets);
  }

  private toSmallestUnitBrackets(
    majorBrackets: ReadonlyArray<{
      upToExclusive: number | null;
      rateBps: number;
    }>,
    periodMultiplier: number,
  ): TaxBracket[] {
    return majorBrackets.map((b) => ({
      upToExclusive:
        b.upToExclusive === null
          ? null
          : b.upToExclusive * periodMultiplier * SMALLEST_UNITS_PER_MAJOR,
      rateBps: b.rateBps,
    }));
  }

  private applyProgressiveBrackets(
    incomeSmallest: number,
    brackets: readonly TaxBracket[],
  ): number {
    if (incomeSmallest <= 0) {
      return 0;
    }

    let tax = 0;
    let lowerBound = 0;

    for (const bracket of brackets) {
      const upperBound = bracket.upToExclusive;

      if (incomeSmallest <= lowerBound) {
        break;
      }

      const sliceCeiling =
        upperBound === null ? incomeSmallest : Math.min(incomeSmallest, upperBound);
      const taxableInBand = sliceCeiling - lowerBound;

      if (taxableInBand > 0) {
        tax += this.applyRateBps(taxableInBand, bracket.rateBps);
      }

      if (upperBound === null || incomeSmallest <= upperBound) {
        break;
      }

      lowerBound = upperBound;
    }

    return tax;
  }

  private applyRateBps(amountSmallest: number, rateBps: number): number {
    if (amountSmallest === 0 || rateBps === 0) {
      return 0;
    }

    const amount = Math.trunc(amountSmallest);
    const numerator = BigInt(amount) * BigInt(rateBps) + 5_000n;
    return Number(numerator / 10_000n);
  }

  private computeEffectiveRate(grossIncome: number, taxAmount: number): number {
    if (grossIncome <= 0) {
      return 0;
    }

    const scaled =
      (BigInt(taxAmount) * 1_000_000n + BigInt(grossIncome) / 2n) / BigInt(grossIncome);

    return Number(scaled) / 1_000_000;
  }
}
