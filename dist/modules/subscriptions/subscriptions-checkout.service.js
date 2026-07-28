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
exports.SubscriptionsCheckoutService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const paypal_service_1 = require("../payments/paypal.service");
const subscriptions_service_1 = require("./subscriptions.service");
let SubscriptionsCheckoutService = class SubscriptionsCheckoutService {
    constructor(prisma, paypalService, subscriptionsService) {
        this.prisma = prisma;
        this.paypalService = paypalService;
        this.subscriptionsService = subscriptionsService;
    }
    async checkout(userId, dto) {
        const plan = await this.prisma.plan.findUnique({ where: { id: dto.planId } });
        if (!plan || !plan.isActive)
            throw new common_1.NotFoundException('Plan not found or inactive');
        if (!plan.paypalPlanId) {
            throw new common_1.BadRequestException('This plan is not yet configured for checkout');
        }
        await this.subscriptionsService.assertNoActiveSubscription(userId);
        const result = await this.paypalService.createSubscription({
            userId,
            amount: plan.priceAmount / 100,
            currency: plan.currency,
            subscriptionPlanId: plan.paypalPlanId,
            description: `Beleqet ${plan.name} subscription`,
        });
        const subscription = await this.subscriptionsService.createPendingCheckout({
            userId,
            planId: plan.id,
            provider: client_1.PaymentProvider.PAYPAL,
            providerSubscriptionId: result.id,
        });
        return { subscription, approvalUrl: result.approvalUrl };
    }
    async cancel(id, userId) {
        const subscription = await this.prisma.subscription.findUnique({ where: { id } });
        if (!subscription || subscription.userId !== userId) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        const updatedSubscription = await this.subscriptionsService.cancel(id, userId);
        if (subscription.provider === client_1.PaymentProvider.PAYPAL && subscription.providerSubscriptionId) {
            try {
                await this.paypalService.cancelSubscription(subscription.providerSubscriptionId);
            }
            catch (error) {
                await this.prisma.subscription.update({
                    where: { id },
                    data: { cancelAtPeriodEnd: subscription.cancelAtPeriodEnd },
                });
                throw error;
            }
        }
        return updatedSubscription;
    }
};
exports.SubscriptionsCheckoutService = SubscriptionsCheckoutService;
exports.SubscriptionsCheckoutService = SubscriptionsCheckoutService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        paypal_service_1.PaypalService,
        subscriptions_service_1.SubscriptionsService])
], SubscriptionsCheckoutService);
//# sourceMappingURL=subscriptions-checkout.service.js.map