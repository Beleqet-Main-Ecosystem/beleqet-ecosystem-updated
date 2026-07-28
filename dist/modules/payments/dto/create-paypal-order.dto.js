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
exports.CreatePaypalOrderDto = exports.PaypalOrderIntent = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
var PaypalOrderIntent;
(function (PaypalOrderIntent) {
    PaypalOrderIntent["CAPTURE"] = "CAPTURE";
    PaypalOrderIntent["AUTHORIZE"] = "AUTHORIZE";
})(PaypalOrderIntent || (exports.PaypalOrderIntent = PaypalOrderIntent = {}));
class CreatePaypalOrderDto {
    constructor() {
        this.intent = PaypalOrderIntent.CAPTURE;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { amount: { required: true, type: () => Number, minimum: 0.01, minimum: 1 }, currency: { required: true, type: () => String, minLength: 3, maxLength: 3 }, userId: { required: true, type: () => String }, intent: { required: false, default: PaypalOrderIntent.CAPTURE, enum: require("./create-paypal-order.dto").PaypalOrderIntent }, description: { required: false, type: () => String, minLength: 1, maxLength: 127 }, returnUrl: { required: false, type: () => String }, cancelUrl: { required: false, type: () => String }, subscriptionPlanId: { required: false, type: () => String, minLength: 1, maxLength: 64 }, cycles: { required: false, type: () => Number, minimum: 1, maximum: 999 } };
    }
}
exports.CreatePaypalOrderDto = CreatePaypalOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Payment amount (2 decimal places for most currencies)',
        example: 25.0,
        minimum: 0.01,
    }),
    (0, class_validator_1.IsNumber)({ maxDecimalPlaces: 2 }),
    (0, class_validator_1.IsPositive)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreatePaypalOrderDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ISO 4217 3-letter currency code',
        example: 'USD',
        minLength: 3,
        maxLength: 3,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUppercase)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'UUID of the Beleqet user initiating the payment',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'PayPal order intent',
        enum: PaypalOrderIntent,
        default: PaypalOrderIntent.CAPTURE,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(PaypalOrderIntent),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "intent", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Payment description shown in payer PayPal account',
        example: 'Beleqet Premium Job Posting',
        maxLength: 127,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 127),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Return URL after PayPal approval (must be HTTPS in prod)',
        example: 'https://beleqet.com/payment/success',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "returnUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Cancel URL if payer cancels at PayPal',
        example: 'https://beleqet.com/payment/cancel',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUrl)({ require_tld: false }),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "cancelUrl", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'PayPal Billing Plan ID for subscription/recurring payments',
        example: 'P-12345678901234567ABCDEFG',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], CreatePaypalOrderDto.prototype, "subscriptionPlanId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Number of billing cycles (for subscriptions)',
        example: 12,
        minimum: 1,
        maximum: 999,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(1),
    (0, class_validator_1.Max)(999),
    (0, class_transformer_1.Type)(() => Number),
    __metadata("design:type", Number)
], CreatePaypalOrderDto.prototype, "cycles", void 0);
//# sourceMappingURL=create-paypal-order.dto.js.map