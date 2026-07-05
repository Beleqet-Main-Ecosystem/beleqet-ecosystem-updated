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
exports.CreateSubscriptionDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class CreateSubscriptionDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { planId: { required: true, type: () => String, maxLength: 50 }, planLabel: { required: false, type: () => String, enum: ['MONTHLY', 'ANNUAL'] } };
    }
}
exports.CreateSubscriptionDto = CreateSubscriptionDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 'P-5ML4271244454362WXNWU5NQ',
        description: 'PayPal Billing Plan ID (from Dashboard → Catalog → Plans). ' +
            'In mock mode, any string value is accepted.',
        maxLength: 50,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "planId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 'MONTHLY',
        description: 'Display label for the plan. Used for UI rendering and audit logging only. ' +
            'Not sent to PayPal.',
        enum: ['MONTHLY', 'ANNUAL'],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsIn)(['MONTHLY', 'ANNUAL'], {
        message: 'planLabel must be either MONTHLY or ANNUAL',
    }),
    __metadata("design:type", String)
], CreateSubscriptionDto.prototype, "planLabel", void 0);
//# sourceMappingURL=create-subscription.dto.js.map