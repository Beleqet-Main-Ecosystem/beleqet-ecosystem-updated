"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaxCalculatorController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const nestjs_i18n_1 = require("nestjs-i18n");
const calculate_tax_dto_1 = require("./dto/calculate-tax.dto");
const tax_calculator_service_1 = require("./tax-calculator.service");
let TaxCalculatorController = class TaxCalculatorController {
    constructor(taxCalculatorService, i18n) {
        this.taxCalculatorService = taxCalculatorService;
        this.i18n = i18n;
    }
    async calculate(dto) {
        try {
            return this.taxCalculatorService.calculate(dto);
        }
        catch (error) {
            if (error instanceof common_1.BadRequestException) {
                throw await this.mapBadRequest(error, dto);
            }
            if (error instanceof common_1.HttpException) {
                throw error;
            }
            const message = await this.resolveI18nMessage('messages.tax.calculationFailed', 'Tax calculation failed. Please try again.');
            throw new common_1.InternalServerErrorException({
                statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
                errorCode: 'ERR_TAX_CALCULATION_FAILED',
                message,
            });
        }
    }
    async mapBadRequest(error, dto) {
        const response = error.getResponse();
        const payload = typeof response === 'object' && response !== null
            ? response
            : {};
        const errorCode = typeof payload.errorCode === 'string' ? payload.errorCode : undefined;
        const countryCode = (typeof payload.countryCode === 'string'
            ? payload.countryCode
            : (dto.countryCode?.toUpperCase?.() ?? dto.countryCode)) || undefined;
        if (errorCode === 'ERR_TAX_CURRENCY_MISMATCH') {
            const expectedCurrency = typeof payload.expectedCurrency === 'string'
                ? payload.expectedCurrency
                : countryCode === 'ET'
                    ? 'ETB'
                    : countryCode === 'US'
                        ? 'USD'
                        : undefined;
            const message = await this.resolveI18nMessage('messages.tax.currencyMismatch', `Currency "${dto.currency}" does not match jurisdiction "${countryCode}". Expected ${expectedCurrency}.`, {
                countryCode,
                currency: dto.currency,
                expectedCurrency,
            });
            return new common_1.BadRequestException({
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                errorCode: 'ERR_TAX_CURRENCY_MISMATCH',
                message,
                countryCode,
                currency: dto.currency,
                expectedCurrency,
            });
        }
        if (errorCode === 'ERR_TAX_INVALID_GROSS_INCOME') {
            const message = await this.resolveI18nMessage('messages.tax.invalidGrossIncome', 'grossIncome must be a finite number in smallest currency units.');
            return new common_1.BadRequestException({
                statusCode: common_1.HttpStatus.BAD_REQUEST,
                errorCode: 'ERR_TAX_INVALID_GROSS_INCOME',
                message,
            });
        }
        const message = await this.resolveI18nMessage('messages.tax.unsupportedJurisdiction', `Unsupported tax jurisdiction "${countryCode}". Supported: ET, US.`, { countryCode });
        return new common_1.BadRequestException({
            statusCode: common_1.HttpStatus.BAD_REQUEST,
            errorCode: 'ERR_TAX_UNSUPPORTED_JURISDICTION',
            message,
            countryCode,
        });
    }
    async resolveI18nMessage(key, defaultValue, args) {
        const translated = await this.i18n.t(key, { args, defaultValue });
        if (typeof translated === 'string') {
            return translated;
        }
        return defaultValue;
    }
};
exports.TaxCalculatorController = TaxCalculatorController;
__decorate([
    (0, common_1.Post)('calculate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Calculate freelancer tax liability',
        description: 'Estimates progressive tax for ET or US jurisdictions using integer smallest-unit math.',
    }),
    (0, swagger_1.ApiBody)({ type: calculate_tax_dto_1.CalculateTaxDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Tax calculation result' }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Validation failed, unsupported jurisdiction, or currency/jurisdiction mismatch',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [calculate_tax_dto_1.CalculateTaxDto]),
    __metadata("design:returntype", Promise)
], TaxCalculatorController.prototype, "calculate", null);
exports.TaxCalculatorController = TaxCalculatorController = __decorate([
    (0, swagger_1.ApiTags)('tax-calculator'),
    (0, common_1.Controller)('tax-calculator'),
    __metadata("design:paramtypes", [tax_calculator_service_1.TaxCalculatorService,
        nestjs_i18n_1.I18nService])
], TaxCalculatorController);
//# sourceMappingURL=tax-calculator.controller.js.map