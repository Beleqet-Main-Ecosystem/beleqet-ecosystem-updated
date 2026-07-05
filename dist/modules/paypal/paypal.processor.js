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
var PaypalProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const bull_2 = require("@nestjs/bull");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const paypal_dispute_service_1 = require("./paypal-dispute.service");
const paypal_i18n_service_1 = require("./paypal-i18n.service");
let PaypalProcessor = PaypalProcessor_1 = class PaypalProcessor {
    constructor(prisma, disputeService, i18n, notificationsQueue) {
        this.prisma = prisma;
        this.disputeService = disputeService;
        this.i18n = i18n;
        this.notificationsQueue = notificationsQueue;
        this.logger = new common_1.Logger(PaypalProcessor_1.name);
    }
    async handleCaptureWebhook(job) {
        const { eventType, resource } = job.data;
        const captureId = resource.id;
        this.logger.log(`[paypal-webhook] ${eventType} captureId=${captureId}`);
        const orderId = resource.supplementary_data?.related_ids?.order_id;
        const tx = await this.prisma.paypalTransaction.findFirst({
            where: {
                OR: [
                    { paypalCaptureId: captureId },
                    ...(orderId ? [{ paypalOrderId: orderId }] : []),
                ],
            },
        });
        if (!tx) {
            this.logger.warn(`[paypal-webhook] No local transaction for captureId=${captureId} orderId=${orderId} — ignoring`);
            return;
        }
        if (tx.status === 'CAPTURED' && eventType === 'PAYMENT.CAPTURE.COMPLETED') {
            this.logger.debug(`[paypal-webhook] Already CAPTURED — skipping duplicate`);
            return;
        }
        let newStatus;
        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
                newStatus = 'CAPTURED';
                break;
            case 'PAYMENT.CAPTURE.REFUNDED':
                newStatus = 'REFUNDED';
                break;
            default:
                newStatus = 'FAILED';
        }
        await this.prisma.$transaction([
            this.prisma.paypalTransaction.update({
                where: { id: tx.id },
                data: {
                    status: newStatus,
                    paypalCaptureId: captureId,
                    gatewayResponse: resource,
                },
            }),
            this.prisma.eventLog.create({
                data: {
                    eventType: `paypal.${eventType.toLowerCase()}`,
                    entityId: tx.id,
                    entityType: 'PaypalTransaction',
                    payload: { captureId, status: newStatus },
                    processedBy: PaypalProcessor_1.name,
                },
            }),
        ]);
        const locale = 'en';
        const amount = resource.amount?.value ?? Number(tx.amount).toFixed(2);
        const currency = resource.amount?.currency_code ?? tx.currency;
        const notifTitle = newStatus === 'CAPTURED'
            ? '✅ Payment confirmed via PayPal'
            : '❌ PayPal payment failed';
        const notifBody = newStatus === 'CAPTURED'
            ? this.i18n.t('paypal.payment.confirmed', locale, { currency, amount })
            : this.i18n.t('paypal.payment.failed', locale);
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: tx.clientId,
            type: `paypal.${newStatus.toLowerCase()}`,
            title: notifTitle,
            body: notifBody,
            metadata: { transactionId: tx.id, captureId },
        });
        this.logger.log(`[paypal-webhook] Transaction ${tx.id} updated to ${newStatus}`);
    }
    async handleSubscriptionWebhook(job) {
        const { eventType, resource } = job.data;
        const paypalSubscriptionId = resource.id;
        this.logger.log(`[paypal-sub] ${eventType} subscriptionId=${paypalSubscriptionId}`);
        const record = await this.prisma.paypalSubscription.findUnique({
            where: { paypalSubscriptionId },
        });
        if (!record) {
            this.logger.warn(`[paypal-sub] Unknown subscription ${paypalSubscriptionId} — creating minimal record`);
            return;
        }
        const statusMap = {
            'BILLING.SUBSCRIPTION.ACTIVATED': 'ACTIVE',
            'BILLING.SUBSCRIPTION.CANCELLED': 'CANCELLED',
            'BILLING.SUBSCRIPTION.SUSPENDED': 'SUSPENDED',
            'BILLING.SUBSCRIPTION.EXPIRED': 'EXPIRED',
        };
        const newStatus = statusMap[eventType] ?? 'ACTIVE';
        const nextBillingTime = resource.billing_info?.next_billing_time
            ? new Date(resource.billing_info.next_billing_time)
            : null;
        await this.prisma.paypalSubscription.update({
            where: { id: record.id },
            data: {
                status: newStatus,
                nextBillingTime: nextBillingTime ?? undefined,
                cancelledAt: newStatus === 'CANCELLED' ? new Date() : undefined,
                suspendedAt: newStatus === 'SUSPENDED' ? new Date() : undefined,
                startTime: newStatus === 'ACTIVE' && !record.startTime ? new Date() : undefined,
                gatewayResponse: resource,
            },
        });
        const i18nKeyMap = {
            ACTIVE: 'paypal.subscription.active',
            CANCELLED: 'paypal.subscription.cancelled',
            SUSPENDED: 'paypal.subscription.suspended',
            EXPIRED: 'paypal.subscription.expired',
        };
        const titleMap = {
            ACTIVE: '✅ Subscription activated',
            CANCELLED: '🚫 Subscription cancelled',
            SUSPENDED: '⏸ Subscription suspended',
            EXPIRED: '⌛ Subscription expired',
        };
        const locale = 'en';
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: record.userId,
            type: `paypal.subscription.${newStatus.toLowerCase()}`,
            title: titleMap[newStatus] ?? 'Subscription updated',
            body: this.i18n.t(i18nKeyMap[newStatus] ?? 'paypal.subscription.active', locale),
            metadata: { subscriptionId: paypalSubscriptionId, status: newStatus },
        });
        this.logger.log(`[paypal-sub] Subscription ${paypalSubscriptionId} → ${newStatus}`);
    }
    async handleDisputeWebhook(job) {
        const { resource } = job.data;
        this.logger.log(`[paypal-dispute] Processing dispute ${resource.dispute_id}`);
        await this.disputeService.upsertDispute(resource);
        const locale = 'en';
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
            userId: 'ADMIN',
            type: 'paypal.dispute.created',
            title: '⚠️ New PayPal Dispute',
            body: this.i18n.t('paypal.dispute.created', locale, {
                disputeId: resource.dispute_id,
            }),
            metadata: { disputeId: resource.dispute_id },
        });
        this.logger.log(`[paypal-dispute] Dispute ${resource.dispute_id} synced`);
    }
    onFailed(job, error) {
        this.logger.error(`[paypal-queue] Job failed: [${job.name}] id=${job.id} attempt=${job.attemptsMade}`, error.stack);
    }
};
exports.PaypalProcessor = PaypalProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.PAYPAL_JOBS.PROCESS_WEBHOOK),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaypalProcessor.prototype, "handleCaptureWebhook", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.PAYPAL_JOBS.SYNC_SUBSCRIPTION),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaypalProcessor.prototype, "handleSubscriptionWebhook", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.PAYPAL_JOBS.SYNC_DISPUTE),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], PaypalProcessor.prototype, "handleDisputeWebhook", null);
__decorate([
    (0, bull_1.OnQueueFailed)(),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Error]),
    __metadata("design:returntype", void 0)
], PaypalProcessor.prototype, "onFailed", null);
exports.PaypalProcessor = PaypalProcessor = PaypalProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.PAYPAL),
    __param(3, (0, bull_2.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        paypal_dispute_service_1.PaypalDisputeService,
        paypal_i18n_service_1.PaypalI18nService, Object])
], PaypalProcessor);
//# sourceMappingURL=paypal.processor.js.map