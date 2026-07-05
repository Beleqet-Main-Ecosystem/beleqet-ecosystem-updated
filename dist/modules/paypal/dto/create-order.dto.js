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
exports.CreateOrderDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateOrderDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { amount: { required: true, type: () => Number, minimum: 0.01 }, currency: { required: true, type: () => String, enum: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ETB'] }, freelanceJobId: { required: false, type: () => String }, freelancerId: { required: false, type: () => String }, idempotencyKey: { required: false, type: () => String, maxLength: 36 } };
    }
}
exports.CreateOrderDto = CreateOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 150.0,
        description: 'Amount to charge the buyer. Must be > 0 with at most 2 decimal places.',
        minimum: 0.01,
        type: Number,
    }),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.Min)(0.01, { message: 'Amount must be at least 0.01' }),
    __metadata("design:type", Number)
], CreateOrderDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'USD',
        description: 'ISO-4217 3-letter currency code. ETB is accepted in mock mode only.',
        enum: ['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ETB'],
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['USD', 'EUR', 'GBP', 'AUD', 'CAD', 'ETB'], {
        message: 'Unsupported currency. Use USD, EUR, GBP, AUD, CAD, or ETB (mock mode only).',
    }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'a2fd1c8b-12e3-4f92-9d2b-4c6e18b3c7e1',
        description: 'UUID v4 of the FreelanceJob to associate this payment with',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4', { message: 'freelanceJobId must be a valid UUID v4' }),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "freelanceJobId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        description: 'UUID v4 of the freelancer who will receive the payment',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)('4'),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "freelancerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'order-attempt-001-2026-07-05',
        description: 'Client-supplied idempotency key (max 36 chars). Auto-generated if omitted. ' +
            'Use the same key when retrying to prevent duplicate orders.',
        maxLength: 36,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(36),
    __metadata("design:type", String)
], CreateOrderDto.prototype, "idempotencyKey", void 0);
//# sourceMappingURL=create-order.dto.js.map