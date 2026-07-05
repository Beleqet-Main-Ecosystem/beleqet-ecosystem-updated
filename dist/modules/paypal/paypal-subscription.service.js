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
var PaypalSubscriptionService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalSubscriptionService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const axios_1 = require("axios");
const prisma_service_1 = require("../../prisma/prisma.service");
const paypal_auth_service_1 = require("./paypal-auth.service");
const paypal_pii_utils_1 = require("./paypal-pii.utils");
let PaypalSubscriptionService = PaypalSubscriptionService_1 = class PaypalSubscriptionService {
    constructor(prisma, auth, config) {
        this.prisma = prisma;
        this.auth = auth;
        this.config = config;
        this.logger = new common_1.Logger(PaypalSubscriptionService_1.name);
    }
    async createSubscription(userId, dto) {
        const returnUrl = this.config.get('PAYPAL_RETURN_URL', 'http://localhost:3000/payment-success');
        const cancelUrl = this.config.get('PAYPAL_CANCEL_URL', 'http://localhost:3000/payment-cancel');
        let paypalSubId;
        let approveUrl;
        let rawResponse;
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        if (mode === 'mock') {
            paypalSubId = `MOCK-SUB-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
            approveUrl = `${frontendUrl}/paypal-mock-checkout?subscriptionId=${paypalSubId}&planId=${dto.planId}&type=subscription`;
            rawResponse = { status: 'APPROVAL_PENDING', simulated: true };
        }
        else {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            try {
                const response = await axios_1.default.post(`${baseUrl}/v1/billing/subscriptions`, {
                    plan_id: dto.planId,
                    application_context: {
                        brand_name: 'Beleqet',
                        locale: 'en-US',
                        shipping_preference: 'NO_SHIPPING',
                        user_action: 'SUBSCRIBE_NOW',
                        return_url: returnUrl,
                        cancel_url: cancelUrl,
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        Accept: 'application/json',
                        'Prefer': 'return=representation',
                    },
                });
                rawResponse = response.data;
                paypalSubId = response.data.id;
                const approveLink = response.data.links.find((l) => l.rel === 'approve');
                if (!approveLink) {
                    throw new common_1.BadRequestException('PayPal did not return an approve link for the subscription');
                }
                approveUrl = approveLink.href;
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException)
                    throw err;
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Failed to create PayPal subscription: ${msg}`);
                throw new common_1.BadRequestException(`PayPal subscription creation failed: ${msg}`);
            }
        }
        const record = await this.prisma.paypalSubscription.create({
            data: {
                paypalSubscriptionId: paypalSubId,
                paypalPlanId: dto.planId,
                status: 'APPROVAL_PENDING',
                userId,
                gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(rawResponse),
            },
        });
        this.logger.log(`Subscription created: ${paypalSubId} for user ${userId} on plan ${dto.planId}`);
        return {
            localId: record.id,
            subscriptionId: paypalSubId,
            approveUrl,
            planId: dto.planId,
            planLabel: dto.planLabel,
        };
    }
    async suspendSubscription(userId, subscriptionId) {
        const record = await this.findOwnedSubscription(userId, subscriptionId);
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        if (mode !== 'mock') {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            try {
                await axios_1.default.post(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}/suspend`, { reason: 'Suspended by subscriber via Beleqet platform' }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            }
            catch (err) {
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Failed to suspend subscription ${subscriptionId}: ${msg}`);
                throw new common_1.BadRequestException(`PayPal suspend failed: ${msg}`);
            }
        }
        const updated = await this.prisma.paypalSubscription.update({
            where: { id: record.id },
            data: { status: 'SUSPENDED', suspendedAt: new Date() },
        });
        this.logger.log(`Subscription ${subscriptionId} suspended for user ${userId}`);
        return updated;
    }
    async cancelSubscription(userId, subscriptionId) {
        const record = await this.findOwnedSubscription(userId, subscriptionId);
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        if (mode !== 'mock') {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            try {
                await axios_1.default.post(`${baseUrl}/v1/billing/subscriptions/${subscriptionId}/cancel`, { reason: 'Cancelled by subscriber via Beleqet platform' }, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
            }
            catch (err) {
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Failed to cancel subscription ${subscriptionId}: ${msg}`);
                throw new common_1.BadRequestException(`PayPal cancel failed: ${msg}`);
            }
        }
        const updated = await this.prisma.paypalSubscription.update({
            where: { id: record.id },
            data: { status: 'CANCELLED', cancelledAt: new Date() },
        });
        this.logger.log(`Subscription ${subscriptionId} cancelled for user ${userId}`);
        return updated;
    }
    async findOwnedSubscription(userId, subscriptionId) {
        const record = await this.prisma.paypalSubscription.findFirst({
            where: { paypalSubscriptionId: subscriptionId, userId },
        });
        if (!record) {
            throw new common_1.NotFoundException(`Subscription ${subscriptionId} not found for user ${userId}`);
        }
        return record;
    }
};
exports.PaypalSubscriptionService = PaypalSubscriptionService;
exports.PaypalSubscriptionService = PaypalSubscriptionService = PaypalSubscriptionService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        paypal_auth_service_1.PaypalAuthService,
        config_1.ConfigService])
], PaypalSubscriptionService);
//# sourceMappingURL=paypal-subscription.service.js.map