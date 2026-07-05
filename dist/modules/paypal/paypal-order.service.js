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
var PaypalOrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalOrderService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const uuid_1 = require("uuid");
const axios_1 = require("axios");
const prisma_service_1 = require("../../prisma/prisma.service");
const paypal_auth_service_1 = require("./paypal-auth.service");
const paypal_pii_utils_1 = require("./paypal-pii.utils");
const paypal_currency_utils_1 = require("./paypal-currency.utils");
const PLATFORM_FEE_PCT = 0.05;
let PaypalOrderService = PaypalOrderService_1 = class PaypalOrderService {
    constructor(prisma, auth, config) {
        this.prisma = prisma;
        this.auth = auth;
        this.config = config;
        this.logger = new common_1.Logger(PaypalOrderService_1.name);
    }
    async createOrder(clientId, dto) {
        const idempotencyKey = dto.idempotencyKey ?? (0, uuid_1.v4)();
        const existing = await this.prisma.paypalTransaction.findUnique({
            where: { idempotencyKey },
        });
        if (existing) {
            throw new common_1.ConflictException(`Idempotency key "${idempotencyKey}" has already been used. ` +
                'Use a different key or retrieve the existing order.');
        }
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        if ((0, paypal_currency_utils_1.isMockOnlyCurrency)(dto.currency) && mode !== 'mock') {
            throw new common_1.BadRequestException(`Currency "${dto.currency}" is only supported in simulator (mock) mode. ` +
                'PayPal does not support this currency on live/sandbox APIs.');
        }
        const returnUrl = this.config.get('PAYPAL_RETURN_URL', 'http://localhost:3000/payment-success');
        const cancelUrl = this.config.get('PAYPAL_CANCEL_URL', 'http://localhost:3000/payment-cancel');
        const platformFee = +(dto.amount * PLATFORM_FEE_PCT).toFixed(2);
        let paypalOrderId;
        let approveUrl;
        let rawResponse;
        if (mode === 'mock') {
            paypalOrderId = `MOCK-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const frontendUrl = this.config.get('FRONTEND_URL', 'http://localhost:3000');
            approveUrl = `${frontendUrl}/paypal-mock-checkout?orderId=${paypalOrderId}&amount=${dto.amount}&currency=${dto.currency}&type=order`;
            rawResponse = { status: 'CREATED', simulated: true };
        }
        else {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            try {
                const response = await axios_1.default.post(`${baseUrl}/v2/checkout/orders`, {
                    intent: 'CAPTURE',
                    purchase_units: [
                        {
                            amount: {
                                currency_code: dto.currency,
                                value: dto.amount.toFixed(2),
                            },
                            description: 'Beleqet Freelance Payment',
                        },
                    ],
                    application_context: {
                        return_url: returnUrl,
                        cancel_url: cancelUrl,
                        brand_name: 'Beleqet',
                        user_action: 'PAY_NOW',
                        shipping_preference: 'NO_SHIPPING',
                    },
                }, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'PayPal-Request-Id': idempotencyKey,
                    },
                });
                rawResponse = response.data;
                paypalOrderId = response.data.id;
                const approveLink = response.data.links.find((l) => l.rel === 'approve');
                if (!approveLink) {
                    throw new common_1.BadRequestException('PayPal did not return an approve link');
                }
                approveUrl = approveLink.href;
            }
            catch (err) {
                if (err instanceof common_1.BadRequestException)
                    throw err;
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Failed to create PayPal order: ${msg}`);
                throw new common_1.BadRequestException(`PayPal order creation failed: ${msg}`);
            }
        }
        const tx = await this.prisma.paypalTransaction.create({
            data: {
                paypalOrderId,
                status: 'CREATED',
                amount: dto.amount,
                currency: dto.currency,
                platformFee,
                idempotencyKey,
                clientId,
                freelancerId: dto.freelancerId ?? null,
                freelanceJobId: dto.freelanceJobId ?? null,
                gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(rawResponse),
            },
        });
        this.logger.log(`PayPal order created: ${paypalOrderId} for client ${clientId} — ${dto.currency} ${dto.amount}`);
        return {
            transactionId: tx.id,
            orderId: paypalOrderId,
            approveUrl,
            amount: dto.amount,
            currency: dto.currency,
            platformFee,
        };
    }
    async captureOrder(clientId, orderId) {
        const tx = await this.prisma.paypalTransaction.findFirst({
            where: { paypalOrderId: orderId, clientId },
        });
        if (!tx) {
            throw new common_1.NotFoundException(`No transaction found for order ${orderId} belonging to user ${clientId}`);
        }
        if (tx.status === 'CAPTURED') {
            this.logger.debug(`Order ${orderId} already captured — returning cached result`);
            return { status: 'CAPTURED', captureId: tx.paypalCaptureId, transactionId: tx.id };
        }
        const mode = this.config.get('PAYPAL_MODE', 'sandbox');
        let captureId;
        let captureStatus;
        let rawResponse;
        if (mode === 'mock') {
            captureId = `MOCK-CAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            captureStatus = 'COMPLETED';
            rawResponse = { status: 'COMPLETED', simulated: true };
        }
        else {
            const token = await this.auth.getAccessToken();
            const baseUrl = this.auth.getBaseUrl();
            try {
                const response = await axios_1.default.post(`${baseUrl}/v2/checkout/orders/${orderId}/capture`, {}, {
                    headers: {
                        Authorization: `Bearer ${token}`,
                        'Content-Type': 'application/json',
                    },
                });
                rawResponse = response.data;
                captureStatus = response.data.status;
                captureId = response.data.purchase_units[0]?.payments?.captures?.[0]?.id ?? '';
            }
            catch (err) {
                const msg = axios_1.default.isAxiosError(err)
                    ? JSON.stringify(err.response?.data)
                    : String(err);
                this.logger.error(`Failed to capture PayPal order ${orderId}: ${msg}`);
                throw new common_1.BadRequestException(`PayPal capture failed: ${msg}`);
            }
        }
        const newStatus = captureStatus === 'COMPLETED' ? 'CAPTURED' : 'FAILED';
        const updated = await this.prisma.paypalTransaction.update({
            where: { id: tx.id },
            data: {
                paypalCaptureId: captureId || null,
                status: newStatus,
                gatewayResponse: (0, paypal_pii_utils_1.sanitiseForStorage)(rawResponse),
            },
        });
        this.logger.log(`PayPal order ${orderId} ${newStatus} — captureId: ${captureId}`);
        return {
            transactionId: updated.id,
            orderId,
            captureId,
            status: newStatus,
            amount: updated.amount,
            currency: updated.currency,
        };
    }
};
exports.PaypalOrderService = PaypalOrderService;
exports.PaypalOrderService = PaypalOrderService = PaypalOrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        paypal_auth_service_1.PaypalAuthService,
        config_1.ConfigService])
], PaypalOrderService);
//# sourceMappingURL=paypal-order.service.js.map