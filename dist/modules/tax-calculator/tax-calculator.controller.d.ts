import { I18nService } from 'nestjs-i18n';
import { CalculateTaxDto, TaxCalculationResult } from './dto/calculate-tax.dto';
import { TaxCalculatorService } from './tax-calculator.service';
export declare class TaxCalculatorController {
    private readonly taxCalculatorService;
    private readonly i18n;
    constructor(taxCalculatorService: TaxCalculatorService, i18n: I18nService);
    calculate(dto: CalculateTaxDto): Promise<TaxCalculationResult>;
    private mapBadRequest;
    private resolveI18nMessage;
}
