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
exports.BillingController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const billing_service_1 = require("./billing.service");
const generic_billing_webhook_dto_1 = require("./dto/generic-billing-webhook.dto");
let BillingController = class BillingController {
    constructor(billingService) {
        this.billingService = billingService;
    }
    handleWebhook(req, dto, signature) {
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        return this.billingService.handleGenericWebhook(dto, rawBody, signature);
    }
};
exports.BillingController = BillingController;
__decorate([
    (0, common_1.Post)('webhook'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Generic subscription billing webhook receiver',
        description: 'Reserved for payment gateways integrated directly against the Subscription domain. Do not call manually.',
    }),
    (0, swagger_1.ApiHeader)({ name: 'x-billing-signature', description: 'HMAC-SHA256 signature', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed (idempotent)' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Signature verification failed' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __param(2, (0, common_1.Headers)('x-billing-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, generic_billing_webhook_dto_1.GenericBillingWebhookDto, String]),
    __metadata("design:returntype", void 0)
], BillingController.prototype, "handleWebhook", null);
exports.BillingController = BillingController = __decorate([
    (0, swagger_1.ApiTags)('Billing'),
    (0, common_1.Controller)('billing'),
    __metadata("design:paramtypes", [billing_service_1.BillingService])
], BillingController);
//# sourceMappingURL=billing.controller.js.map