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
exports.PaypalWebhookController = exports.PaypalController = exports.StripeWebhookController = exports.StripeController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const throttler_1 = require("@nestjs/throttler");
const stripe_service_1 = require("./stripe.service");
const paypal_service_1 = require("./paypal.service");
const create_payment_intent_dto_1 = require("./dto/create-payment-intent.dto");
const create_paypal_order_dto_1 = require("./dto/create-paypal-order.dto");
const webhook_dto_1 = require("./dto/webhook.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let StripeController = class StripeController {
    constructor(stripeService) {
        this.stripeService = stripeService;
    }
    createPaymentIntent(dto) {
        return this.stripeService.createPaymentIntent(dto);
    }
    confirmPayment(paymentIntentId, paymentMethodId) {
        return this.stripeService.confirmPayment(paymentIntentId, paymentMethodId);
    }
    refund(dto) {
        return this.stripeService.refund(dto);
    }
    listSupportedCurrencies() {
        return this.stripeService.listSupportedCurrencies();
    }
};
exports.StripeController = StripeController;
__decorate([
    (0, common_1.Post)('payment-intent'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a Stripe Payment Intent',
        description: `
Creates a Stripe PaymentIntent for a Beleqet user.
Returns a \`clientSecret\` which must be passed to \`Stripe.js\` on the frontend
to complete the payment flow.

Supports **135+ currencies** (ISO 4217). Metadata is GDPR-sanitised
(raw PII keys are stripped before forwarding to Stripe).
    `,
    }),
    (0, swagger_1.ApiBody)({ type: create_payment_intent_dto_1.CreatePaymentIntentDto }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'PaymentIntent created successfully. Use clientSecret in Stripe.js.',
        schema: {
            example: {
                id: 'pi_3Pq1234567890',
                clientSecret: 'pi_3Pq1234_secret_XXXXXXXX',
                status: 'requires_payment_method',
                amount: 1500,
                currency: 'USD',
                createdAt: '2026-07-06T11:00:00.000Z',
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request (bad currency, missing fields)' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Rate limit exceeded — max 10 per minute' }),
    (0, swagger_1.ApiResponse)({ status: 500, description: 'Stripe API error' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.CREATED, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_payment_intent_dto_1.CreatePaymentIntentDto]),
    __metadata("design:returntype", void 0)
], StripeController.prototype, "createPaymentIntent", null);
__decorate([
    (0, common_1.Post)('confirm/:paymentIntentId'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Confirm a Stripe Payment Intent server-side',
        description: 'Confirms an existing PaymentIntent using a pre-attached payment method.',
    }),
    (0, swagger_1.ApiParam)({ name: 'paymentIntentId', description: 'Stripe Payment Intent ID (pi_…)' }),
    (0, swagger_1.ApiQuery)({
        name: 'paymentMethodId',
        description: 'Stripe Payment Method ID (pm_…)',
        required: true,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'PaymentIntent confirmed' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Card declined or invalid payment method' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Param)('paymentIntentId')),
    __param(1, (0, common_1.Query)('paymentMethodId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], StripeController.prototype, "confirmPayment", null);
__decorate([
    (0, common_1.Post)('refund'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({
        summary: 'Issue a Stripe refund (Admin only)',
        description: 'Issues a full or partial refund against an existing Stripe charge. Requires ADMIN role.',
    }),
    (0, swagger_1.ApiBody)({ type: webhook_dto_1.CreateRefundDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Refund issued successfully' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Forbidden — ADMIN role required' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [webhook_dto_1.CreateRefundDto]),
    __metadata("design:returntype", void 0)
], StripeController.prototype, "refund", null);
__decorate([
    (0, common_1.Get)('currencies'),
    (0, swagger_1.ApiOperation)({
        summary: 'List Stripe-supported currencies',
        description: 'Returns a curated list of ISO 4217 currency codes supported by Stripe, with minimum amounts.',
    }),
    (0, swagger_1.ApiResponse)({
        status: 200,
        description: 'List of supported currencies',
        schema: {
            example: [
                { code: 'USD', minimumAmount: 50, zeroDecimal: false },
                { code: 'ETB', minimumAmount: 100, zeroDecimal: false },
                { code: 'JPY', minimumAmount: 50, zeroDecimal: true },
            ],
        },
    }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], StripeController.prototype, "listSupportedCurrencies", null);
exports.StripeController = StripeController = __decorate([
    (0, swagger_1.ApiTags)('Payments — Stripe'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('payments/stripe'),
    __metadata("design:paramtypes", [stripe_service_1.StripeService])
], StripeController);
let StripeWebhookController = class StripeWebhookController {
    constructor(stripeService) {
        this.stripeService = stripeService;
    }
    handleWebhook(req, signature) {
        const rawBody = req.rawBody ?? Buffer.from(JSON.stringify(req.body));
        return this.stripeService.handleWebhook(rawBody, signature);
    }
};
exports.StripeWebhookController = StripeWebhookController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Stripe webhook receiver',
        description: `
Receives Stripe webhook events. **Do not call manually.**
The body must be the raw Buffer (not JSON-parsed) for HMAC signature verification.

Configure your Stripe webhook endpoint to point to this URL.
Supported events:
- payment_intent.succeeded
- payment_intent.payment_failed
- payment_intent.processing
- charge.refunded
    `,
    }),
    (0, swagger_1.ApiHeader)({
        name: 'stripe-signature',
        description: 'Stripe HMAC signature header',
        required: true,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Signature verification failed' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Headers)('stripe-signature')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], StripeWebhookController.prototype, "handleWebhook", null);
exports.StripeWebhookController = StripeWebhookController = __decorate([
    (0, swagger_1.ApiTags)('Payments — Stripe'),
    (0, common_1.Controller)('payments/stripe/webhook'),
    __metadata("design:paramtypes", [stripe_service_1.StripeService])
], StripeWebhookController);
let PaypalController = class PaypalController {
    constructor(paypalService) {
        this.paypalService = paypalService;
    }
    createOrder(dto) {
        return this.paypalService.createOrder(dto);
    }
    captureOrder(dto, payerId) {
        return this.paypalService.captureOrder(dto, payerId);
    }
    createSubscription(dto) {
        return this.paypalService.createSubscription(dto);
    }
};
exports.PaypalController = PaypalController;
__decorate([
    (0, common_1.Post)('order'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, throttler_1.Throttle)({ default: { limit: 10, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a PayPal Checkout order',
        description: `
Creates a PayPal order and returns an \`approvalUrl\`.
Redirect the user to \`approvalUrl\` for payer approval.

Optionally include \`subscriptionPlanId\` to create a **recurring subscription** instead.
    `,
    }),
    (0, swagger_1.ApiBody)({ type: create_paypal_order_dto_1.CreatePaypalOrderDto }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'PayPal order created. Redirect user to approvalUrl.',
        schema: {
            example: {
                id: '5O190127TN364715T',
                status: 'created',
                approvalUrl: 'https://www.sandbox.paypal.com/cgi-bin/webscr?cmd=_express-checkout&token=…',
                amount: '25.00',
                currency: 'USD',
                createdAt: '2026-07-06T11:00:00.000Z',
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request' }),
    (0, swagger_1.ApiResponse)({ status: 429, description: 'Rate limit exceeded' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.CREATED, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_paypal_order_dto_1.CreatePaypalOrderDto]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Post)('capture'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'Capture an approved PayPal order',
        description: 'Executes (captures) a PayPal order after payer approval. Pass the orderId and PayerID from the PayPal redirect.',
    }),
    (0, swagger_1.ApiBody)({ type: webhook_dto_1.CapturePaypalOrderDto }),
    (0, swagger_1.ApiQuery)({
        name: 'PayerID',
        description: 'PayPal PayerID from approval redirect',
        required: true,
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Order captured successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'PayerID missing or invalid' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Query)('PayerID')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [webhook_dto_1.CapturePaypalOrderDto, String]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "captureOrder", null);
__decorate([
    (0, common_1.Post)('subscription'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, throttler_1.Throttle)({ default: { limit: 5, ttl: 60_000 } }),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a PayPal recurring subscription',
        description: 'Creates a PayPal Billing Agreement (subscription) for recurring payments. Returns approvalUrl to activate.',
    }),
    (0, swagger_1.ApiBody)({ type: create_paypal_order_dto_1.CreatePaypalOrderDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Subscription created. Redirect user to approvalUrl.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'subscriptionPlanId is required' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.CREATED, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_paypal_order_dto_1.CreatePaypalOrderDto]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "createSubscription", null);
exports.PaypalController = PaypalController = __decorate([
    (0, swagger_1.ApiTags)('Payments — PayPal'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('payments/paypal'),
    __metadata("design:paramtypes", [paypal_service_1.PaypalService])
], PaypalController);
let PaypalWebhookController = class PaypalWebhookController {
    constructor(paypalService) {
        this.paypalService = paypalService;
    }
    handleWebhook(body, req) {
        const headers = {};
        for (const key of Object.keys(req.headers)) {
            headers[key] = String(req.headers[key] ?? '');
        }
        return this.paypalService.handleWebhook(body, headers);
    }
};
exports.PaypalWebhookController = PaypalWebhookController;
__decorate([
    (0, common_1.Post)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'PayPal webhook receiver',
        description: `
Receives PayPal webhook events. **Do not call manually.**

Supported events:
- PAYMENT.CAPTURE.COMPLETED
- PAYMENT.CAPTURE.DENIED
- PAYMENT.SALE.COMPLETED
- PAYMENT.SALE.REFUNDED
- BILLING.SUBSCRIPTION.ACTIVATED
- BILLING.SUBSCRIPTION.CANCELLED
    `,
    }),
    (0, swagger_1.ApiHeader)({
        name: 'paypal-transmission-id',
        description: 'PayPal transmission ID',
        required: true,
    }),
    (0, swagger_1.ApiHeader)({ name: 'paypal-transmission-sig', description: 'PayPal signature', required: true }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Webhook processed' }),
    (0, swagger_1.ApiResponse)({ status: 422, description: 'Signature verification failed' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", void 0)
], PaypalWebhookController.prototype, "handleWebhook", null);
exports.PaypalWebhookController = PaypalWebhookController = __decorate([
    (0, swagger_1.ApiTags)('Payments — PayPal'),
    (0, common_1.Controller)('payments/paypal/webhook'),
    __metadata("design:paramtypes", [paypal_service_1.PaypalService])
], PaypalWebhookController);
//# sourceMappingURL=payments.controller.js.map