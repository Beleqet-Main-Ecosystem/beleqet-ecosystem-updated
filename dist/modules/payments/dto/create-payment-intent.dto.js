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
exports.CreatePaymentIntentDto = exports.StripePaymentMethod = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var StripePaymentMethod;
(function (StripePaymentMethod) {
    StripePaymentMethod["CARD"] = "card";
    StripePaymentMethod["SEPA_DEBIT"] = "sepa_debit";
    StripePaymentMethod["KLARNA"] = "klarna";
    StripePaymentMethod["IDEAL"] = "ideal";
    StripePaymentMethod["AFTERPAY"] = "afterpay_clearpay";
    StripePaymentMethod["PAYPAL"] = "paypal";
})(StripePaymentMethod || (exports.StripePaymentMethod = StripePaymentMethod = {}));
class CreatePaymentIntentDto {
    constructor() {
        this.paymentMethodType = StripePaymentMethod.CARD;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { amount: { required: true, type: () => Number, minimum: 1 }, currency: { required: true, type: () => String, minLength: 3, maxLength: 3 }, userId: { required: true, type: () => String }, description: { required: false, type: () => String, minLength: 1, maxLength: 255 }, paymentMethodType: { required: false, default: StripePaymentMethod.CARD, enum: require("./create-payment-intent.dto").StripePaymentMethod }, metadata: { required: false, type: () => Object } };
    }
}
exports.CreatePaymentIntentDto = CreatePaymentIntentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Amount in the smallest currency unit (e.g. 1500 = $15.00 USD)',
        example: 1500,
        minimum: 1,
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreatePaymentIntentDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'ISO 4217 3-letter currency code (e.g. USD, EUR, ETB)',
        example: 'USD',
        minLength: 3,
        maxLength: 3,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUppercase)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'UUID of the Beleqet user initiating the payment',
        example: '550e8400-e29b-41d4-a716-446655440000',
    }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "userId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Human-readable description of the payment (e.g. "Job Posting - Senior Dev")',
        example: 'Job Posting Fee - Senior Developer',
        maxLength: 255,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Stripe payment method type',
        enum: StripePaymentMethod,
        default: StripePaymentMethod.CARD,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(StripePaymentMethod),
    __metadata("design:type", String)
], CreatePaymentIntentDto.prototype, "paymentMethodType", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Optional metadata key-value pairs (GDPR-sanitised before storage)',
        example: { jobId: 'abc123', planTier: 'premium' },
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreatePaymentIntentDto.prototype, "metadata", void 0);
//# sourceMappingURL=create-payment-intent.dto.js.map