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
exports.RefundDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class RefundDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { amount: { required: false, type: () => Number, minimum: 0.01, maximum: 100000 }, currency: { required: false, type: () => String, maxLength: 3, pattern: "/^[A-Z]{3}$/" }, note: { required: false, type: () => String, maxLength: 255 } };
    }
}
exports.RefundDto = RefundDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 50.0,
        description: 'Partial refund amount (with at most 2 decimal places). ' +
            'Omit to issue a full refund of the entire captured amount.',
        minimum: 0.01,
        maximum: 100_000,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.Max)(100_000),
    __metadata("design:type", Number)
], RefundDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'USD',
        description: 'ISO-4217 3-letter currency code (must match capture currency). ' +
            'Defaults to the transaction\'s stored currency when omitted.',
        pattern: '^[A-Z]{3}$',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(3),
    (0, class_validator_1.Matches)(/^[A-Z]{3}$/, {
        message: 'currency must be a valid ISO-4217 code (e.g. USD, EUR, GBP)',
    }),
    __metadata("design:type", String)
], RefundDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'Client requested cancellation before delivery start date',
        description: 'Internal note explaining the refund reason (max 255 chars). ' +
            'Sent to PayPal as note_to_payer.',
        maxLength: 255,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(255),
    __metadata("design:type", String)
], RefundDto.prototype, "note", void 0);
//# sourceMappingURL=refund.dto.js.map