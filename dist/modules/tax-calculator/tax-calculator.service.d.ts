import { CalculateTaxDto, TaxCalculationResult } from './dto/calculate-tax.dto';
export declare class TaxCalculatorService {
    private static readonly ET_MONTHLY_BRACKETS_MAJOR;
    private static readonly US_FEDERAL_SINGLE_BRACKETS_MAJOR;
    calculate(dto: CalculateTaxDto): TaxCalculationResult;
    private assertCurrencyMatchesJurisdiction;
    private normalizeGrossIncome;
    private calculateEthiopianTax;
    private calculateUnitedStatesTax;
    private toSmallestUnitBrackets;
    private applyProgressiveBrackets;
    private applyRateBps;
    private computeEffectiveRate;
}
