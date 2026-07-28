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
exports.GenericBillingWebhookDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const LIFECYCLE_EVENTS = [
    'ACTIVATED',
    'RENEWED',
    'PAYMENT_FAILED',
    'CANCELLED',
    'EXPIRED',
];
class GenericBillingWebhookDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { gatewayEventId: { required: true, type: () => String }, provider: { required: true, type: () => Object }, eventType: { required: true, type: () => Object, enum: LIFECYCLE_EVENTS }, providerSubscriptionId: { required: true, type: () => String }, amount: { required: false, type: () => Number }, currency: { required: false, type: () => String, minLength: 3, maxLength: 3 }, gatewayReference: { required: false, type: () => String }, rawPayload: { required: false, type: () => Object } };
    }
}
exports.GenericBillingWebhookDto = GenericBillingWebhookDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: "Gateway's own event id (idempotency key)" }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "gatewayEventId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.PaymentProvider }),
    (0, class_validator_1.IsEnum)(client_1.PaymentProvider),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "provider", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: LIFECYCLE_EVENTS }),
    (0, class_validator_1.IsIn)(LIFECYCLE_EVENTS),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "eventType", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Gateway-side recurring-billing id' }),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "providerSubscriptionId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Charge amount in minor units' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], GenericBillingWebhookDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ISO 4217 currency code' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUppercase)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Provider-side reference for this specific charge' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], GenericBillingWebhookDto.prototype, "gatewayReference", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Raw event payload for the audit trail (PII must already be stripped)',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], GenericBillingWebhookDto.prototype, "rawPayload", void 0);
//# sourceMappingURL=generic-billing-webhook.dto.js.map