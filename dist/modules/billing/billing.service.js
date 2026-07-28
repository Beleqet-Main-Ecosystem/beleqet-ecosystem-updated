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
var BillingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const crypto_1 = require("crypto");
const subscriptions_service_1 = require("../subscriptions/subscriptions.service");
const paypal_service_1 = require("../payments/paypal.service");
const wallet_service_1 = require("../wallet/wallet.service");
let BillingService = BillingService_1 = class BillingService {
    constructor(subscriptionsService, walletService, config) {
        this.subscriptionsService = subscriptionsService;
        this.walletService = walletService;
        this.config = config;
        this.logger = new common_1.Logger(BillingService_1.name);
        this.webhookSecret = this.config.get('BILLING_WEBHOOK_SECRET', '');
    }
    async handleSubscriptionLifecycleEvent(payload) {
        await this.subscriptionsService.syncFromProviderEvent(payload);
    }
    convertToPlanCurrency(amount, from, to) {
        return this.walletService.convertCurrency(amount, from, to);
    }
    async handleGenericWebhook(dto, rawBody, signature) {
        this.verifySignature(rawBody, signature);
        await this.subscriptionsService.syncFromProviderEvent({
            gatewayEventId: dto.gatewayEventId,
            provider: dto.provider,
            eventType: dto.eventType,
            providerSubscriptionId: dto.providerSubscriptionId,
            amount: dto.amount,
            currency: dto.currency,
            gatewayReference: dto.gatewayReference,
            rawPayload: dto.rawPayload ?? {},
        });
    }
    verifySignature(rawBody, signature) {
        if (!this.webhookSecret) {
            this.logger.warn('BILLING_WEBHOOK_SECRET not set — skipping signature verification (unsafe for production)');
            return;
        }
        const expected = (0, crypto_1.createHmac)('sha256', this.webhookSecret).update(rawBody).digest('hex');
        const expectedBuf = Buffer.from(expected);
        const providedBuf = Buffer.from(signature ?? '');
        if (expectedBuf.length !== providedBuf.length || !(0, crypto_1.timingSafeEqual)(expectedBuf, providedBuf)) {
            throw new common_1.UnprocessableEntityException('Invalid billing webhook signature.');
        }
    }
};
exports.BillingService = BillingService;
__decorate([
    (0, event_emitter_1.OnEvent)(paypal_service_1.SUBSCRIPTION_LIFECYCLE_EVENT),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], BillingService.prototype, "handleSubscriptionLifecycleEvent", null);
exports.BillingService = BillingService = BillingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService,
        wallet_service_1.WalletService,
        config_1.ConfigService])
], BillingService);
//# sourceMappingURL=billing.service.js.map