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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CalculateTaxDto = exports.TaxCurrency = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var TaxCurrency;
(function (TaxCurrency) {
    TaxCurrency["USD"] = "USD";
    TaxCurrency["ETB"] = "ETB";
})(TaxCurrency || (exports.TaxCurrency = TaxCurrency = {}));
class CalculateTaxDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { grossIncome: { required: true, type: () => Number, minimum: 0 }, currency: { required: true, enum: require("./calculate-tax.dto").TaxCurrency }, countryCode: { required: true, type: () => String, minLength: 2, maxLength: 2, pattern: "/^[A-Z]{2}$/" } };
    }
}
exports.CalculateTaxDto = CalculateTaxDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Gross income in smallest currency unit (cents/Santim). Annual freelancer income.',
        example: 12000000,
        minimum: 0,
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], CalculateTaxDto.prototype, "grossIncome", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ISO 4217 currency code',
        enum: TaxCurrency,
        example: TaxCurrency.ETB,
    }),
    (0, class_validator_1.IsEnum)(TaxCurrency),
    __metadata("design:type", String)
], CalculateTaxDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ISO 3166-1 alpha-2 country code selecting the tax ruleset',
        example: 'ET',
        minLength: 2,
        maxLength: 2,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUppercase)(),
    (0, class_validator_1.Length)(2, 2),
    (0, class_validator_1.Matches)(/^[A-Z]{2}$/, {
        message: 'countryCode must be a 2-letter ISO country code (e.g. US, ET)',
    }),
    __metadata("design:type", String)
], CalculateTaxDto.prototype, "countryCode", void 0);
//# sourceMappingURL=calculate-tax.dto.js.map