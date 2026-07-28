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
exports.CreatePlanDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class CreatePlanDto {
    constructor() {
        this.currency = 'ETB';
        this.interval = client_1.BillingInterval.MONTHLY;
        this.isActive = true;
    }
    static _OPENAPI_METADATA_FACTORY() {
        return { name: { required: true, type: () => String, minLength: 2, maxLength: 60 }, description: { required: false, type: () => String, maxLength: 500 }, priceAmount: { required: true, type: () => Number, minimum: 1 }, currency: { required: false, type: () => String, default: "ETB", minLength: 3, maxLength: 3 }, interval: { required: false, type: () => Object, default: client_1.BillingInterval.MONTHLY }, features: { required: true, type: () => Object }, isActive: { required: false, type: () => Boolean, default: true }, paypalPlanId: { required: false, type: () => String, maxLength: 64 } };
    }
}
exports.CreatePlanDto = CreatePlanDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unique plan name', example: 'Pro' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Human-readable plan description' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Price in minor units (e.g. cents/santim)', example: 99900 }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.IsPositive)(),
    __metadata("design:type", Number)
], CreatePlanDto.prototype, "priceAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'ISO 4217 currency code', example: 'ETB', default: 'ETB' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsUppercase)(),
    (0, class_validator_1.Length)(3, 3),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "currency", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: client_1.BillingInterval, default: client_1.BillingInterval.MONTHLY }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(client_1.BillingInterval),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "interval", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Feature flags / limits for this plan',
        example: { maxJobPosts: 5, support: 'email' },
    }),
    (0, class_validator_1.IsObject)(),
    __metadata("design:type", Object)
], CreatePlanDto.prototype, "features", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreatePlanDto.prototype, "isActive", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'PayPal billing plan id (P-XXXXXXXXX)' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], CreatePlanDto.prototype, "paypalPlanId", void 0);
//# sourceMappingURL=create-plan.dto.js.map