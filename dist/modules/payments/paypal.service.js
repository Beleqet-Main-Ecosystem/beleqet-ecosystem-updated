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
var PaypalService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalService = exports.SUBSCRIPTION_LIFECYCLE_EVENT = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const event_emitter_1 = require("@nestjs/event-emitter");
const paypal = require("paypal-rest-sdk");
const prisma_service_1 = require("../../prisma/prisma.service");
const create_paypal_order_dto_1 = require("./dto/create-paypal-order.dto");
exports.SUBSCRIPTION_LIFECYCLE_EVENT = 'billing.subscription.lifecycle';
let PaypalService = PaypalService_1 = class PaypalService {
    constructor(config, prisma, eventEmitter) {
        this.config = config;
        this.prisma = prisma;
        this.eventEmitter = eventEmitter;
        this.logger = new common_1.Logger(PaypalService_1.name);
        const clientId = this.config.getOrThrow('PAYPAL_CLIENT_ID');
        const clientSecret = this.config.getOrThrow('PAYPAL_CLIENT_SECRET');
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        this.webhookId = this.config.get('PAYPAL_WEBHOOK_ID', '');
        this.returnUrlBase = this.config.get('PAYPAL_RETURN_URL', 'https://beleqet.com/payment/success');
        this.cancelUrlBase = this.config.get('PAYPAL_CANCEL_URL', 'https://beleqet.com/payment/cancel');
        paypal.configure({
            mode,
            client_id: clientId,
            client_secret: clientSecret,
        });
        this.logger.log(`PayPal SDK configured in ${mode} mode`);
    }
    async createOrder(dto) {
        if (dto.subscriptionPlanId) {
            const sub = await this.createSubscription(dto);
            return {
                id: sub.id,
                status: sub.status,
                approvalUrl: sub.approvalUrl,
                amount: dto.amount.toFixed(2),
                currency: dto.currency.toUpperCase(),
                createdAt: sub.createdAt,
            };
        }
        const returnUrl = dto.returnUrl ?? this.returnUrlBase;
        const cancelUrl = dto.cancelUrl ?? this.cancelUrlBase;
        const createPaymentJson = {
            intent: (dto.intent ?? create_paypal_order_dto_1.PaypalOrderIntent.CAPTURE).toLowerCase(),
            payer: { payment_method: 'paypal' },
            redirect_urls: {
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
            transactions: [
                {
                    amount: {
                        total: dto.amount.toFixed(2),
                        currency: dto.currency.toUpperCase(),
                    },
                    description: dto.description ?? 'Beleqet Platform Payment',
                    custom: dto.userId,
                },
            ],
        };
        this.logger.log(`Creating PayPal order: amount=${dto.amount} ${dto.currency} userId=${dto.userId}`);
        return new Promise((resolve, reject) => {
            paypal.payment.create(createPaymentJson, async (err, payment) => {
                if (err) {
                    this.logger.error(`PayPal createOrder failed: ${JSON.stringify(err)}`);
                    reject(new common_1.InternalServerErrorException('PayPal order creation failed. Please try again.'));
                    return;
                }
                const approvalLink = (payment.links ?? []).find((l) => l.rel === 'approval_url');
                await this.upsertPaymentRecord({
                    userId: dto.userId,
                    provider: 'PAYPAL',
                    providerPaymentId: payment.id,
                    amount: Math.round(dto.amount * 100),
                    currency: dto.currency.toUpperCase(),
                    status: 'PENDING',
                    description: dto.description ?? null,
                });
                resolve({
                    id: payment.id,
                    status: payment.state ?? 'created',
                    approvalUrl: approvalLink?.href ?? null,
                    amount: dto.amount.toFixed(2),
                    currency: dto.currency.toUpperCase(),
                    createdAt: new Date().toISOString(),
                });
            });
        });
    }
    async captureOrder(dto, payerId) {
        if (!payerId) {
            throw new common_1.BadRequestException('PayerID is required to capture a PayPal order.');
        }
        this.logger.log(`Capturing PayPal order: ${dto.orderId} payerId=${payerId}`);
        const executePaymentJson = { payer_id: payerId };
        return new Promise((resolve, reject) => {
            paypal.payment.execute(dto.orderId, executePaymentJson, async (err, payment) => {
                if (err) {
                    this.logger.error(`PayPal captureOrder failed: ${JSON.stringify(err)}`);
                    reject(new common_1.InternalServerErrorException('PayPal order capture failed. Please try again.'));
                    return;
                }
                const captureId = payment.transactions?.[0]?.related_resources?.[0]?.sale?.id ?? null;
                const succeeded = payment.state === 'approved';
                await this.updatePaymentStatusByProviderPaymentId(dto.orderId, succeeded ? 'SUCCEEDED' : 'FAILED');
                resolve({
                    orderId: dto.orderId,
                    status: payment.state ?? 'unknown',
                    captureId,
                    capturedAt: new Date().toISOString(),
                });
            });
        });
    }
    async createSubscription(dto) {
        if (!dto.subscriptionPlanId) {
            throw new common_1.BadRequestException('subscriptionPlanId is required for subscriptions.');
        }
        const returnUrl = dto.returnUrl ?? this.returnUrlBase;
        const cancelUrl = dto.cancelUrl ?? this.cancelUrlBase;
        const billingAgreementAttributes = {
            name: dto.description ?? 'Beleqet Subscription',
            description: `Beleqet recurring payment — userId: ${dto.userId}`,
            start_date: new Date(Date.now() + 60_000).toISOString(),
            plan: { id: dto.subscriptionPlanId },
            payer: { payment_method: 'paypal' },
            redirect_urls: {
                return_url: returnUrl,
                cancel_url: cancelUrl,
            },
        };
        this.logger.log(`Creating PayPal subscription: planId=${dto.subscriptionPlanId} userId=${dto.userId}`);
        return new Promise((resolve, reject) => {
            paypal.billingAgreement.create(billingAgreementAttributes, async (err, billingAgreement) => {
                if (err) {
                    this.logger.error(`PayPal createSubscription failed: ${JSON.stringify(err)}`);
                    reject(new common_1.InternalServerErrorException('PayPal subscription creation failed. Please try again.'));
                    return;
                }
                const approvalLink = (billingAgreement.links ?? []).find((l) => l.rel === 'approval_url');
                await this.upsertPaymentRecord({
                    userId: dto.userId,
                    provider: 'PAYPAL',
                    providerPaymentId: billingAgreement.id,
                    amount: Math.round(dto.amount * 100),
                    currency: dto.currency.toUpperCase(),
                    status: 'PENDING',
                    description: `Subscription: ${dto.subscriptionPlanId}`,
                });
                resolve({
                    id: billingAgreement.id,
                    status: billingAgreement.state ?? 'Pending',
                    approvalUrl: approvalLink?.href ?? null,
                    planId: dto.subscriptionPlanId,
                    createdAt: new Date().toISOString(),
                });
            });
        });
    }
    async cancelSubscription(providerSubscriptionId, note = 'Cancelled by user') {
        this.logger.log(`Cancelling PayPal billing agreement: ${providerSubscriptionId}`);
        return new Promise((resolve, reject) => {
            paypal.billingAgreement.cancel(providerSubscriptionId, { note }, (err) => {
                if (err) {
                    this.logger.error(`PayPal cancelSubscription failed: ${JSON.stringify(err)}`);
                    reject(new common_1.InternalServerErrorException('Failed to cancel PayPal subscription.'));
                    return;
                }
                resolve();
            });
        });
    }
    async handleWebhook(body, headers) {
        this.logger.log(`PayPal webhook received: ${body.event_type} (${body.id})`);
        this.logger.debug(`PayPal webhook headers: ${JSON.stringify(headers)}`);
        if (this.webhookId) {
            await this.verifyWebhookSignature(body, headers);
        }
        else {
            this.logger.warn('PAYPAL_WEBHOOK_ID not set — skipping signature verification (unsafe for production)');
        }
        await this.processWebhookEvent(body);
        return body;
    }
    verifyWebhookSignature(body, headers) {
        const verifyData = {
            transmission_id: headers['paypal-transmission-id'] ?? '',
            transmission_time: headers['paypal-transmission-time'] ?? '',
            cert_url: headers['paypal-cert-url'] ?? '',
            auth_algo: headers['paypal-auth-algo'] ?? '',
            transmission_sig: headers['paypal-transmission-sig'] ?? '',
            webhook_id: this.webhookId,
            webhook_event: body,
        };
        return new Promise((resolve, reject) => {
            paypal.notification.webhookEvent.verify(verifyData, (err, response) => {
                if (err) {
                    this.logger.error(`PayPal webhook verification error: ${JSON.stringify(err)}`);
                    reject(new common_1.UnprocessableEntityException('PayPal webhook verification failed.'));
                    return;
                }
                if (response.verification_status !== 'SUCCESS') {
                    this.logger.warn('PayPal webhook verification returned non-SUCCESS status');
                    reject(new common_1.UnprocessableEntityException('PayPal webhook signature invalid.'));
                    return;
                }
                resolve();
            });
        });
    }
    async processWebhookEvent(event) {
        const resource = event.resource;
        const orderId = resource['id'] ?? '';
        const billingAgreementId = resource['billing_agreement_id'];
        const resourceAmount = resource['amount'];
        switch (event.event_type) {
            case 'PAYMENT.CAPTURE.COMPLETED':
            case 'PAYMENT.SALE.COMPLETED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'SUCCEEDED');
                if (billingAgreementId) {
                    await this.emitSubscriptionLifecycleEvent(event, 'RENEWED', billingAgreementId, resourceAmount, orderId);
                }
                break;
            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.SALE.DENIED':
            case 'PAYMENT.SALE.REVERSED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'FAILED');
                if (billingAgreementId) {
                    await this.emitSubscriptionLifecycleEvent(event, 'PAYMENT_FAILED', billingAgreementId, resourceAmount, orderId);
                }
                break;
            case 'PAYMENT.CAPTURE.REFUNDED':
            case 'PAYMENT.SALE.REFUNDED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'REFUNDED');
                break;
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'SUCCEEDED');
                await this.emitSubscriptionLifecycleEvent(event, 'ACTIVATED', orderId, resourceAmount);
                break;
            case 'BILLING.SUBSCRIPTION.CANCELLED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'CANCELLED');
                await this.emitSubscriptionLifecycleEvent(event, 'CANCELLED', orderId);
                break;
            case 'BILLING.SUBSCRIPTION.EXPIRED':
                await this.updatePaymentStatusByProviderPaymentId(orderId, 'CANCELLED');
                await this.emitSubscriptionLifecycleEvent(event, 'EXPIRED', orderId);
                break;
            default:
                this.logger.debug(`Unhandled PayPal event: ${event.event_type}`);
        }
    }
    async emitSubscriptionLifecycleEvent(event, eventType, providerSubscriptionId, resourceAmount, gatewayReference) {
        const payload = {
            gatewayEventId: event.id,
            provider: 'PAYPAL',
            eventType,
            providerSubscriptionId,
            amount: resourceAmount?.total
                ? Math.round(parseFloat(resourceAmount.total) * 100)
                : undefined,
            currency: resourceAmount?.currency,
            gatewayReference,
            rawPayload: this.sanitizeWebhookPayload(event),
        };
        await this.eventEmitter.emitAsync(exports.SUBSCRIPTION_LIFECYCLE_EVENT, payload);
    }
    sanitizeWebhookPayload(event) {
        const resource = { ...event.resource };
        delete resource['payer'];
        delete resource['payer_info'];
        delete resource['shipping_address'];
        return { id: event.id, event_type: event.event_type, resource };
    }
    async upsertPaymentRecord(data) {
        try {
            await this.prisma.payment.upsert({
                where: { providerPaymentId: data.providerPaymentId },
                update: { status: data.status, updatedAt: new Date() },
                create: {
                    userId: data.userId,
                    provider: data.provider,
                    providerPaymentId: data.providerPaymentId,
                    amount: data.amount,
                    currency: data.currency,
                    status: data.status,
                    description: data.description,
                },
            });
        }
        catch (err) {
            this.logger.error(`Failed to persist PayPal payment record: ${String(err)}`);
        }
    }
    async updatePaymentStatusByProviderPaymentId(providerPaymentId, status) {
        try {
            await this.prisma.payment.updateMany({
                where: { providerPaymentId },
                data: { status, updatedAt: new Date() },
            });
        }
        catch (err) {
            this.logger.error(`Failed to update PayPal payment status (${providerPaymentId}): ${String(err)}`);
        }
    }
};
exports.PaypalService = PaypalService;
exports.PaypalService = PaypalService = PaypalService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService,
        event_emitter_1.EventEmitter2])
], PaypalService);
//# sourceMappingURL=paypal.service.js.map