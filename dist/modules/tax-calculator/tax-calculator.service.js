"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var TaxCalculatorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculatorService = void 0;
const common_1 = require("@nestjs/common");
const calculate_tax_dto_1 = require("./dto/calculate-tax.dto");
const SMALLEST_UNITS_PER_MAJOR = 100;
const MONTHS_PER_YEAR = 12;
const US_STANDARD_DEDUCTION_SINGLE_CENTS = 1_460_000;
const EXPECTED_CURRENCY = {
    ET: calculate_tax_dto_1.TaxCurrency.ETB,
    US: calculate_tax_dto_1.TaxCurrency.USD,
};
let TaxCalculatorService = TaxCalculatorService_1 = class TaxCalculatorService {
    calculate(dto) {
        const { currency, countryCode } = dto;
        const code = countryCode.toUpperCase();
        this.assertCurrencyMatchesJurisdiction(code, currency);
        const grossIncome = this.normalizeGrossIncome(dto.grossIncome);
        let taxAmount;
        switch (code) {
            case 'ET':
                taxAmount = this.calculateEthiopianTax(grossIncome);
                break;
            case 'US':
                taxAmount = this.calculateUnitedStatesTax(grossIncome);
                break;
            default:
                throw new common_1.BadRequestException({
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
    assertCurrencyMatchesJurisdiction(countryCode, currency) {
        if (countryCode !== 'ET' && countryCode !== 'US') {
            return;
        }
        const expected = EXPECTED_CURRENCY[countryCode];
        if (currency !== expected) {
            throw new common_1.BadRequestException({
                statusCode: 400,
                errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
                message: `Currency "${currency}" does not match jurisdiction "${countryCode}". Expected ${expected}.`,
                countryCode,
                currency,
                expectedCurrency: expected,
            });
        }
    }
    normalizeGrossIncome(grossIncome) {
        if (typeof grossIncome !== 'number' || !Number.isFinite(grossIncome)) {
            throw new common_1.BadRequestException({
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
    calculateEthiopianTax(annualSantim) {
        const brackets = this.toSmallestUnitBrackets(TaxCalculatorService_1.ET_MONTHLY_BRACKETS_MAJOR, MONTHS_PER_YEAR);
        return this.applyProgressiveBrackets(annualSantim, brackets);
    }
    calculateUnitedStatesTax(annualCents) {
        const taxableIncome = annualCents - US_STANDARD_DEDUCTION_SINGLE_CENTS;
        if (taxableIncome <= 0) {
            return 0;
        }
        const brackets = this.toSmallestUnitBrackets(TaxCalculatorService_1.US_FEDERAL_SINGLE_BRACKETS_MAJOR, 1);
        return this.applyProgressiveBrackets(taxableIncome, brackets);
    }
    toSmallestUnitBrackets(majorBrackets, periodMultiplier) {
        return majorBrackets.map((b) => ({
            upToExclusive: b.upToExclusive === null
                ? null
                : b.upToExclusive * periodMultiplier * SMALLEST_UNITS_PER_MAJOR,
            rateBps: b.rateBps,
        }));
    }
    applyProgressiveBrackets(incomeSmallest, brackets) {
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
            const sliceCeiling = upperBound === null ? incomeSmallest : Math.min(incomeSmallest, upperBound);
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
    applyRateBps(amountSmallest, rateBps) {
        if (amountSmallest === 0 || rateBps === 0) {
            return 0;
        }
        const amount = Math.trunc(amountSmallest);
        const numerator = BigInt(amount) * BigInt(rateBps) + 5000n;
        return Number(numerator / 10000n);
    }
    computeEffectiveRate(grossIncome, taxAmount) {
        if (grossIncome <= 0) {
            return 0;
        }
        const scaled = (BigInt(taxAmount) * 1000000n + BigInt(grossIncome) / 2n) / BigInt(grossIncome);
        return Number(scaled) / 1_000_000;
    }
};
exports.TaxCalculatorService = TaxCalculatorService;
TaxCalculatorService.ET_MONTHLY_BRACKETS_MAJOR = [
    { upToExclusive: 600, rateBps: 0 },
    { upToExclusive: 1_650, rateBps: 1_000 },
    { upToExclusive: 3_200, rateBps: 1_500 },
    { upToExclusive: 5_250, rateBps: 2_000 },
    { upToExclusive: 7_800, rateBps: 2_500 },
    { upToExclusive: 10_900, rateBps: 3_000 },
    { upToExclusive: null, rateBps: 3_500 },
];
TaxCalculatorService.US_FEDERAL_SINGLE_BRACKETS_MAJOR = [
    { upToExclusive: 11_925, rateBps: 1_000 },
    { upToExclusive: 48_475, rateBps: 1_200 },
    { upToExclusive: 103_350, rateBps: 2_200 },
    { upToExclusive: 197_300, rateBps: 2_400 },
    { upToExclusive: 250_525, rateBps: 3_200 },
    { upToExclusive: 626_350, rateBps: 3_500 },
    { upToExclusive: null, rateBps: 3_700 },
];
exports.TaxCalculatorService = TaxCalculatorService = TaxCalculatorService_1 = __decorate([
    (0, common_1.Injectable)()
], TaxCalculatorService);
//# sourceMappingURL=tax-calculator.service.js.map