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
exports.PaypalController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const paypal_order_service_1 = require("./paypal-order.service");
const paypal_subscription_service_1 = require("./paypal-subscription.service");
const paypal_webhook_service_1 = require("./paypal-webhook.service");
const paypal_dispute_service_1 = require("./paypal-dispute.service");
const create_order_dto_1 = require("./dto/create-order.dto");
const create_subscription_dto_1 = require("./dto/create-subscription.dto");
const refund_dto_1 = require("./dto/refund.dto");
let PaypalController = class PaypalController {
    constructor(orderSvc, subscriptionSvc, webhookSvc, disputeSvc) {
        this.orderSvc = orderSvc;
        this.subscriptionSvc = subscriptionSvc;
        this.webhookSvc = webhookSvc;
        this.disputeSvc = disputeSvc;
    }
    createOrder(user, dto) {
        return this.orderSvc.createOrder(user.userId, dto);
    }
    captureOrder(user, orderId) {
        return this.orderSvc.captureOrder(user.userId, orderId);
    }
    createSubscription(user, dto) {
        return this.subscriptionSvc.createSubscription(user.userId, dto);
    }
    suspendSubscription(user, subscriptionId) {
        return this.subscriptionSvc.suspendSubscription(user.userId, subscriptionId);
    }
    cancelSubscription(user, subscriptionId) {
        return this.subscriptionSvc.cancelSubscription(user.userId, subscriptionId);
    }
    refund(user, captureId, dto) {
        return this.disputeSvc.refund(captureId, user.userId, dto);
    }
    async webhook(req, body) {
        await this.webhookSvc.verifyAndDispatch(req, body);
        return { received: true };
    }
    health() {
        return { module: 'paypal', status: 'ok' };
    }
};
exports.PaypalController = PaypalController;
__decorate([
    (0, common_1.Post)('create-order'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a PayPal one-time payment order',
        description: 'Initiates a PayPal Order for the specified amount and currency. ' +
            'Returns an `approveUrl` to redirect the buyer to PayPal for approval.',
    }),
    (0, swagger_1.ApiBody)({ type: create_order_dto_1.CreateOrderDto }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Order created — redirect the user to `approveUrl`',
        schema: {
            example: {
                transactionId: 'uuid-v4',
                orderId: '5O190127TN364715T',
                approveUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=...',
                amount: 150.0,
                currency: 'USD',
                platformFee: 7.5,
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid request or PayPal rejection' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'Duplicate idempotency key' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_order_dto_1.CreateOrderDto]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "createOrder", null);
__decorate([
    (0, common_1.Post)('capture-order/:orderId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Capture an approved PayPal order',
        description: 'Finalises the charge on an order that has been approved by the buyer. ' +
            'Safe to retry — returns cached result if already captured.',
    }),
    (0, swagger_1.ApiParam)({ name: 'orderId', description: 'PayPal Order ID', example: '5O190127TN364715T' }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Order captured successfully',
        schema: {
            example: {
                transactionId: 'uuid-v4',
                orderId: '5O190127TN364715T',
                captureId: '3C679366HH908993F',
                status: 'CAPTURED',
                amount: '150.00',
                currency: 'USD',
            },
        },
    }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Order not found for this user' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('orderId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "captureOrder", null);
__decorate([
    (0, common_1.Post)('create-subscription'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Create a PayPal recurring subscription',
        description: 'Initiates a billing agreement for the given plan ID. ' +
            'The user must be redirected to `approveUrl` to activate the subscription.',
    }),
    (0, swagger_1.ApiBody)({ type: create_subscription_dto_1.CreateSubscriptionDto }),
    (0, swagger_1.ApiResponse)({
        status: 201,
        description: 'Subscription initiated — redirect user to `approveUrl`',
        schema: {
            example: {
                localId: 'uuid-v4',
                subscriptionId: 'I-BW452GLLEP1G',
                approveUrl: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions/...',
                planId: 'P-5ML4271244454362WXNWU5NQ',
            },
        },
    }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, create_subscription_dto_1.CreateSubscriptionDto]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "createSubscription", null);
__decorate([
    (0, common_1.Post)('subscriptions/:subscriptionId/suspend'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Suspend a PayPal subscription' }),
    (0, swagger_1.ApiParam)({ name: 'subscriptionId', description: 'PayPal Subscription ID', example: 'I-BW452GLLEP1G' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Subscription suspended' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found for this user' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('subscriptionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "suspendSubscription", null);
__decorate([
    (0, common_1.Post)('subscriptions/:subscriptionId/cancel'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Cancel a PayPal subscription (permanent)' }),
    (0, swagger_1.ApiParam)({ name: 'subscriptionId', description: 'PayPal Subscription ID', example: 'I-BW452GLLEP1G' }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Subscription cancelled' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found for this user' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('subscriptionId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "cancelSubscription", null);
__decorate([
    (0, common_1.Post)('refund/:captureId'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({
        summary: 'Refund a captured PayPal payment',
        description: 'Issues a full refund when `amount` is omitted, or a partial refund ' +
            'when an `amount` value is provided. Only the original payer (client) ' +
            'can initiate a refund.',
    }),
    (0, swagger_1.ApiParam)({ name: 'captureId', description: 'PayPal Capture ID', example: '3C679366HH908993F' }),
    (0, swagger_1.ApiBody)({ type: refund_dto_1.RefundDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Refund issued successfully' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Capture ID not found for this user' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Param)('captureId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, refund_dto_1.RefundDto]),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "refund", null);
__decorate([
    (0, common_1.Post)('webhooks'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'PayPal webhook receiver (public — verified via signature)',
        description: "Receives PayPal webhook events. The signature is verified against " +
            "PayPal's public certs before any processing. Do not call this endpoint directly.",
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Event accepted and queued' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or missing PayPal signature' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], PaypalController.prototype, "webhook", null);
__decorate([
    (0, common_1.Get)('health'),
    (0, swagger_1.ApiOperation)({ summary: 'PayPal module health check' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Module is live' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], PaypalController.prototype, "health", null);
exports.PaypalController = PaypalController = __decorate([
    (0, swagger_1.ApiTags)('paypal'),
    (0, common_1.Controller)('paypal'),
    __metadata("design:paramtypes", [paypal_order_service_1.PaypalOrderService,
        paypal_subscription_service_1.PaypalSubscriptionService,
        paypal_webhook_service_1.PaypalWebhookService,
        paypal_dispute_service_1.PaypalDisputeService])
], PaypalController);
//# sourceMappingURL=paypal.controller.js.map