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
exports.CapturePaypalOrderDto = exports.CreateRefundDto = exports.PaypalWebhookDto = exports.StripeWebhookDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class StripeWebhookDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { stripeSignature: { required: true, type: () => String } };
    }
}
exports.StripeWebhookDto = StripeWebhookDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Value of the Stripe-Signature header sent by Stripe',
        example: 't=1729012345,v1=abc123...',
    }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], StripeWebhookDto.prototype, "stripeSignature", void 0);
class PaypalWebhookDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { transmissionId: { required: true, type: () => String }, transmissionTime: { required: true, type: () => String }, certUrl: { required: true, type: () => String }, authAlgo: { required: true, type: () => String }, transmissionSig: { required: true, type: () => String } };
    }
}
exports.PaypalWebhookDto = PaypalWebhookDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PayPal-Transmission-Id header' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaypalWebhookDto.prototype, "transmissionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PayPal-Transmission-Time header' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaypalWebhookDto.prototype, "transmissionTime", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PayPal-Cert-Url header — certificate URL' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaypalWebhookDto.prototype, "certUrl", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PayPal-Auth-Algo header — algorithm used for signature' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaypalWebhookDto.prototype, "authAlgo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'PayPal-Transmission-Sig header — signature value' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], PaypalWebhookDto.prototype, "transmissionSig", void 0);
class CreateRefundDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { paymentIntentId: { required: true, type: () => String, minLength: 1, maxLength: 255 }, amount: { required: false, type: () => Number, minimum: 1 }, reason: { required: false, type: () => String, minLength: 1, maxLength: 255 } };
    }
}
exports.CreateRefundDto = CreateRefundDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Stripe Payment Intent ID to refund',
        example: 'pi_3Pq1234567890',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], CreateRefundDto.prototype, "paymentIntentId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Partial refund amount in smallest currency unit. Omit for full refund.',
        example: 500,
        minimum: 1,
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], CreateRefundDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Reason for refund (shown in Stripe dashboard)',
        example: 'Job posting removed by admin',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 255),
    __metadata("design:type", String)
], CreateRefundDto.prototype, "reason", void 0);
class CapturePaypalOrderDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { orderId: { required: true, type: () => String, minLength: 1, maxLength: 64 } };
    }
}
exports.CapturePaypalOrderDto = CapturePaypalOrderDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'PayPal Order ID to capture',
        example: '5O190127TN364715T',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(1, 64),
    __metadata("design:type", String)
], CapturePaypalOrderDto.prototype, "orderId", void 0);
//# sourceMappingURL=webhook.dto.js.map