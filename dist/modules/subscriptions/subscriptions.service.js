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
var SubscriptionsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionsService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
function addInterval(date, interval) {
    const next = new Date(date);
    if (interval === 'YEARLY') {
        next.setFullYear(next.getFullYear() + 1);
    }
    else {
        next.setMonth(next.getMonth() + 1);
    }
    return next;
}
let SubscriptionsService = SubscriptionsService_1 = class SubscriptionsService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(SubscriptionsService_1.name);
    }
    findMine(userId) {
        return this.prisma.subscription.findFirst({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            include: { plan: true },
        });
    }
    findAllForAdmin(status) {
        return this.prisma.subscription.findMany({
            where: status ? { status } : {},
            orderBy: { createdAt: 'desc' },
            include: {
                plan: true,
                user: { select: { id: true, email: true, firstName: true, lastName: true } },
            },
        });
    }
    async createPendingCheckout(params) {
        const plan = await this.prisma.plan.findUnique({ where: { id: params.planId } });
        if (!plan)
            throw new common_1.NotFoundException('Plan not found');
        return this.prisma.subscription.create({
            data: {
                userId: params.userId,
                planId: params.planId,
                status: client_1.SubscriptionStatus.PENDING,
                provider: params.provider,
                providerSubscriptionId: params.providerSubscriptionId,
                currentPeriodStart: new Date(),
                currentPeriodEnd: addInterval(new Date(), plan.interval),
            },
        });
    }
    async assertNoActiveSubscription(userId) {
        const existing = await this.prisma.subscription.findFirst({
            where: {
                userId,
                status: {
                    in: [client_1.SubscriptionStatus.ACTIVE, client_1.SubscriptionStatus.PAST_DUE, client_1.SubscriptionStatus.PENDING],
                },
            },
        });
        if (existing) {
            throw new common_1.ConflictException('You already have an active or pending subscription');
        }
    }
    async cancel(id, userId) {
        const subscription = await this.prisma.subscription.findUnique({ where: { id } });
        if (!subscription || subscription.userId !== userId) {
            throw new common_1.NotFoundException('Subscription not found');
        }
        if (subscription.status !== client_1.SubscriptionStatus.ACTIVE &&
            subscription.status !== client_1.SubscriptionStatus.PAST_DUE) {
            throw new common_1.BadRequestException('Only an active or past-due subscription can be cancelled');
        }
        return this.prisma.subscription.update({
            where: { id },
            data: { cancelAtPeriodEnd: true },
        });
    }
    async syncFromProviderEvent(input) {
        const alreadyProcessed = await this.recordWebhookEvent(input);
        if (alreadyProcessed) {
            this.logger.log(`Webhook event ${input.gatewayEventId} already processed — skipping`);
            return;
        }
        const subscription = await this.prisma.subscription.findUnique({
            where: { providerSubscriptionId: input.providerSubscriptionId },
            include: { plan: true },
        });
        if (!subscription) {
            this.logger.warn(`No local subscription found for providerSubscriptionId=${input.providerSubscriptionId} (event=${input.eventType})`);
            return;
        }
        const now = new Date();
        const statusUpdate = this.resolveStatusUpdate(input.eventType, subscription, now);
        await this.prisma.$transaction(async (tx) => {
            if (statusUpdate) {
                await tx.subscription.update({
                    where: { id: subscription.id },
                    data: statusUpdate,
                });
            }
            if (input.amount !== undefined && input.currency) {
                await tx.subscriptionTransaction.create({
                    data: {
                        subscriptionId: subscription.id,
                        amount: input.amount,
                        currency: input.currency,
                        status: this.mapEventToTransactionStatus(input.eventType),
                        gatewayReference: input.gatewayReference,
                        rawPayload: input.rawPayload,
                    },
                });
            }
        });
        this.logger.log(`Subscription ${subscription.id} synced from ${input.provider} event ${input.eventType}`);
    }
    async recordWebhookEvent(input) {
        try {
            await this.prisma.webhookEvent.create({
                data: {
                    gatewayEventId: input.gatewayEventId,
                    provider: input.provider,
                    eventType: input.eventType,
                    payload: (input.rawPayload ?? {}),
                },
            });
            return false;
        }
        catch (err) {
            if (err instanceof client_1.Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
                return true;
            }
            throw err;
        }
    }
    resolveStatusUpdate(eventType, subscription, now) {
        switch (eventType) {
            case 'ACTIVATED':
            case 'RENEWED':
                return {
                    status: client_1.SubscriptionStatus.ACTIVE,
                    currentPeriodStart: now,
                    currentPeriodEnd: addInterval(now, subscription.plan.interval),
                    reminderSentAt: null,
                };
            case 'PAYMENT_FAILED':
                return { status: client_1.SubscriptionStatus.PAST_DUE };
            case 'CANCELLED':
                if (subscription.cancelAtPeriodEnd)
                    return null;
                return { status: client_1.SubscriptionStatus.CANCELLED };
            case 'EXPIRED':
                return { status: client_1.SubscriptionStatus.EXPIRED };
        }
    }
    mapEventToTransactionStatus(eventType) {
        switch (eventType) {
            case 'ACTIVATED':
            case 'RENEWED':
                return client_1.PaymentStatus.SUCCEEDED;
            case 'PAYMENT_FAILED':
                return client_1.PaymentStatus.FAILED;
            case 'CANCELLED':
            case 'EXPIRED':
                return client_1.PaymentStatus.CANCELLED;
        }
    }
    async sweepExpired(now = new Date()) {
        const due = await this.prisma.subscription.findMany({
            where: {
                status: { in: [client_1.SubscriptionStatus.ACTIVE, client_1.SubscriptionStatus.PAST_DUE] },
                currentPeriodEnd: { lt: now },
            },
            select: { id: true, userId: true, cancelAtPeriodEnd: true, plan: { select: { name: true } } },
        });
        if (due.length === 0)
            return [];
        const cancelledIds = due.filter((s) => s.cancelAtPeriodEnd).map((s) => s.id);
        const lapsedIds = due.filter((s) => !s.cancelAtPeriodEnd).map((s) => s.id);
        if (cancelledIds.length > 0) {
            await this.prisma.subscription.updateMany({
                where: { id: { in: cancelledIds } },
                data: { status: client_1.SubscriptionStatus.CANCELLED },
            });
        }
        if (lapsedIds.length > 0) {
            await this.prisma.subscription.updateMany({
                where: { id: { in: lapsedIds } },
                data: { status: client_1.SubscriptionStatus.EXPIRED },
            });
        }
        return due.map((s) => ({ id: s.id, userId: s.userId, planName: s.plan.name }));
    }
    async findAndMarkDueForReminder(daysAhead = 3, now = new Date()) {
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() + daysAhead);
        const due = await this.prisma.subscription.findMany({
            where: {
                status: client_1.SubscriptionStatus.ACTIVE,
                reminderSentAt: null,
                currentPeriodEnd: { lte: threshold, gt: now },
            },
            select: { id: true, userId: true, currentPeriodEnd: true, plan: { select: { name: true } } },
        });
        if (due.length === 0)
            return [];
        await this.prisma.subscription.updateMany({
            where: { id: { in: due.map((s) => s.id) } },
            data: { reminderSentAt: now },
        });
        return due.map((s) => ({
            id: s.id,
            userId: s.userId,
            planName: s.plan.name,
            currentPeriodEnd: s.currentPeriodEnd,
        }));
    }
};
exports.SubscriptionsService = SubscriptionsService;
exports.SubscriptionsService = SubscriptionsService = SubscriptionsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], SubscriptionsService);
//# sourceMappingURL=subscriptions.service.js.map