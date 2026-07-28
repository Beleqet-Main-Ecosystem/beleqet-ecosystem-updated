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
var StripeService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.StripeService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const stripe_1 = require("stripe");
const prisma_service_1 = require("../../prisma/prisma.service");
const create_payment_intent_dto_1 = require("./dto/create-payment-intent.dto");
const STRIPE_SUPPORTED_CURRENCIES = [
    { code: 'USD', minimumAmount: 50, zeroDecimal: false },
    { code: 'EUR', minimumAmount: 50, zeroDecimal: false },
    { code: 'GBP', minimumAmount: 30, zeroDecimal: false },
    { code: 'ETB', minimumAmount: 100, zeroDecimal: false },
    { code: 'KES', minimumAmount: 500, zeroDecimal: false },
    { code: 'NGN', minimumAmount: 5000, zeroDecimal: false },
    { code: 'ZAR', minimumAmount: 500, zeroDecimal: false },
    { code: 'GHS', minimumAmount: 500, zeroDecimal: false },
    { code: 'AED', minimumAmount: 200, zeroDecimal: false },
    { code: 'INR', minimumAmount: 5000, zeroDecimal: false },
    { code: 'CAD', minimumAmount: 50, zeroDecimal: false },
    { code: 'AUD', minimumAmount: 50, zeroDecimal: false },
    { code: 'JPY', minimumAmount: 50, zeroDecimal: true },
    { code: 'CNY', minimumAmount: 100, zeroDecimal: false },
    { code: 'CHF', minimumAmount: 50, zeroDecimal: false },
];
const PII_METADATA_KEYS = ['email', 'phone', 'name', 'address', 'telegramId'];
let StripeService = StripeService_1 = class StripeService {
    constructor(config, prisma) {
        this.config = config;
        this.prisma = prisma;
        this.logger = new common_1.Logger(StripeService_1.name);
        const secretKey = this.config.getOrThrow('STRIPE_SECRET_KEY');
        this.webhookSecret = this.config.getOrThrow('STRIPE_WEBHOOK_SECRET');
        this.stripe = new stripe_1.default(secretKey, {
            apiVersion: '2024-06-20',
            typescript: true,
            appInfo: {
                name: 'Beleqet Platform',
                version: '1.0.0',
                url: 'https://beleqet.com',
            },
        });
    }
    async createPaymentIntent(dto) {
        this.validateCurrency(dto.currency);
        const sanitisedMetadata = this.sanitiseMetadata({
            ...dto.metadata,
            userId: dto.userId,
            beleqet_version: '1.0',
        });
        this.logger.log(`Creating PaymentIntent: amount=${dto.amount} ${dto.currency} userId=${dto.userId}`);
        try {
            const intent = await this.stripe.paymentIntents.create({
                amount: dto.amount,
                currency: dto.currency.toLowerCase(),
                payment_method_types: [dto.paymentMethodType ?? create_payment_intent_dto_1.StripePaymentMethod.CARD],
                description: dto.description,
                metadata: sanitisedMetadata,
            });
            await this.upsertPaymentRecord({
                userId: dto.userId,
                provider: 'STRIPE',
                providerPaymentId: intent.id,
                amount: dto.amount,
                currency: dto.currency.toUpperCase(),
                status: 'PENDING',
                description: dto.description ?? null,
                metadata: sanitisedMetadata,
            });
            return {
                id: intent.id,
                clientSecret: intent.client_secret,
                status: intent.status,
                amount: intent.amount,
                currency: intent.currency.toUpperCase(),
                createdAt: new Date(intent.created * 1000).toISOString(),
            };
        }
        catch (err) {
            this.handleStripeError(err, 'createPaymentIntent');
        }
    }
    async confirmPayment(paymentIntentId, paymentMethodId) {
        this.logger.log(`Confirming PaymentIntent: ${paymentIntentId}`);
        try {
            const intent = await this.stripe.paymentIntents.confirm(paymentIntentId, {
                payment_method: paymentMethodId,
            });
            await this.updatePaymentStatus(intent.id, this.mapStripeStatusToDB(intent.status));
            return {
                id: intent.id,
                clientSecret: intent.client_secret,
                status: intent.status,
                amount: intent.amount,
                currency: intent.currency.toUpperCase(),
                createdAt: new Date(intent.created * 1000).toISOString(),
            };
        }
        catch (err) {
            this.handleStripeError(err, 'confirmPayment');
        }
    }
    async refund(dto) {
        this.logger.log(`Issuing refund: paymentIntentId=${dto.paymentIntentId} amount=${dto.amount ?? 'full'}`);
        try {
            const refundParams = { payment_intent: dto.paymentIntentId };
            if (dto.amount)
                refundParams.amount = dto.amount;
            if (dto.reason)
                refundParams.reason = 'requested_by_customer';
            const refund = await this.stripe.refunds.create(refundParams);
            const newStatus = dto.amount ? 'PARTIALLY_REFUNDED' : 'REFUNDED';
            await this.updatePaymentStatusByProviderPaymentId(dto.paymentIntentId, newStatus);
            return {
                id: refund.id,
                status: refund.status ?? 'unknown',
                amount: refund.amount,
                currency: (refund.currency ?? 'unknown').toUpperCase(),
                paymentIntentId: dto.paymentIntentId,
                createdAt: new Date(refund.created * 1000).toISOString(),
            };
        }
        catch (err) {
            this.handleStripeError(err, 'refund');
        }
    }
    async handleWebhook(rawBody, signatureHeader) {
        let event;
        try {
            event = this.stripe.webhooks.constructEvent(rawBody, signatureHeader, this.webhookSecret);
        }
        catch (err) {
            this.logger.warn(`Stripe webhook signature verification failed: ${String(err)}`);
            throw new common_1.UnprocessableEntityException('Webhook signature verification failed.');
        }
        this.logger.log(`Stripe webhook received: ${event.type} (${event.id})`);
        await this.processWebhookEvent(event);
        return {
            id: event.id,
            type: event.type,
            data: { object: event.data.object },
            created: event.created,
            livemode: event.livemode,
        };
    }
    listSupportedCurrencies() {
        return STRIPE_SUPPORTED_CURRENCIES;
    }
    async processWebhookEvent(event) {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const pi = event.data.object;
                await this.updatePaymentStatusByProviderPaymentId(pi.id, 'SUCCEEDED');
                break;
            }
            case 'payment_intent.payment_failed': {
                const pi = event.data.object;
                await this.updatePaymentStatusByProviderPaymentId(pi.id, 'FAILED');
                break;
            }
            case 'payment_intent.processing': {
                const pi = event.data.object;
                await this.updatePaymentStatusByProviderPaymentId(pi.id, 'PROCESSING');
                break;
            }
            case 'charge.refunded': {
                const charge = event.data.object;
                const paymentIntentId = typeof charge.payment_intent === 'string'
                    ? charge.payment_intent
                    : charge.payment_intent?.id;
                if (paymentIntentId) {
                    await this.updatePaymentStatusByProviderPaymentId(paymentIntentId, 'REFUNDED');
                }
                break;
            }
            default:
                this.logger.debug(`Unhandled Stripe event type: ${event.type}`);
        }
    }
    validateCurrency(currency) {
        const supported = STRIPE_SUPPORTED_CURRENCIES.map((c) => c.code);
        if (!supported.includes(currency.toUpperCase())) {
            this.logger.warn(`Currency ${currency} not in local list — forwarding to Stripe for validation.`);
        }
        if (!/^[A-Z]{3}$/.test(currency.toUpperCase())) {
            throw new common_1.BadRequestException(`Invalid currency code: ${currency}. Must be ISO 4217 3-letter code.`);
        }
    }
    sanitiseMetadata(metadata) {
        const result = {};
        for (const [key, value] of Object.entries(metadata)) {
            if (PII_METADATA_KEYS.includes(key.toLowerCase()))
                continue;
            result[key] = String(value);
        }
        return result;
    }
    mapStripeStatusToDB(status) {
        const map = {
            requires_payment_method: 'PENDING',
            requires_confirmation: 'PENDING',
            requires_action: 'PENDING',
            processing: 'PROCESSING',
            requires_capture: 'PROCESSING',
            canceled: 'CANCELLED',
            succeeded: 'SUCCEEDED',
        };
        return map[status] ?? 'PENDING';
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
                    metadata: data.metadata,
                },
            });
        }
        catch (err) {
            this.logger.error(`Failed to persist payment record: ${String(err)}`);
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
            this.logger.error(`Failed to update payment status (${providerPaymentId}): ${String(err)}`);
        }
    }
    async updatePaymentStatus(providerPaymentId, status) {
        await this.updatePaymentStatusByProviderPaymentId(providerPaymentId, status);
    }
    handleStripeError(err, context) {
        if (err instanceof stripe_1.default.errors.StripeCardError) {
            this.logger.warn(`[${context}] Stripe card error: ${err.message}`);
            throw new common_1.UnprocessableEntityException(err.message);
        }
        if (err instanceof stripe_1.default.errors.StripeInvalidRequestError) {
            this.logger.warn(`[${context}] Stripe invalid request: ${err.message}`);
            throw new common_1.BadRequestException('Invalid payment request. Check your parameters.');
        }
        if (err instanceof stripe_1.default.errors.StripeError) {
            this.logger.error(`[${context}] Stripe API error: ${err.message}`, err);
            throw new common_1.InternalServerErrorException('Payment provider error. Please try again later.');
        }
        this.logger.error(`[${context}] Unexpected error: ${String(err)}`);
        throw new common_1.InternalServerErrorException('An unexpected error occurred during payment processing.');
    }
};
exports.StripeService = StripeService;
exports.StripeService = StripeService = StripeService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService,
        prisma_service_1.PrismaService])
], StripeService);
//# sourceMappingURL=stripe.service.js.map