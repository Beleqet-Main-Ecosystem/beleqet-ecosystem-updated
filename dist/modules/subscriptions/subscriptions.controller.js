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
exports.SubscriptionsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const subscriptions_service_1 = require("./subscriptions.service");
const subscriptions_checkout_service_1 = require("./subscriptions-checkout.service");
const checkout_dto_1 = require("./dto/checkout.dto");
let SubscriptionsController = class SubscriptionsController {
    constructor(subscriptionsService, checkoutService) {
        this.subscriptionsService = subscriptionsService;
        this.checkoutService = checkoutService;
    }
    checkout(user, dto) {
        return this.checkoutService.checkout(user.userId, dto);
    }
    findMine(user) {
        return this.subscriptionsService.findMine(user.userId);
    }
    cancel(id, user) {
        return this.checkoutService.cancel(id, user.userId);
    }
    findAll(status) {
        return this.subscriptionsService.findAllForAdmin(status);
    }
};
exports.SubscriptionsController = SubscriptionsController;
__decorate([
    (0, common_1.Post)('checkout'),
    (0, common_1.HttpCode)(common_1.HttpStatus.CREATED),
    (0, swagger_1.ApiOperation)({
        summary: 'Start a subscription checkout',
        description: 'Creates a gateway (PayPal) recurring billing agreement for the chosen plan and a local PENDING subscription. Redirect the user to the returned approvalUrl to activate it.',
    }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'Checkout started. Redirect user to approvalUrl.' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Plan not found or inactive' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User already has an active or pending subscription' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.CREATED }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, checkout_dto_1.CheckoutDto]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "checkout", null);
__decorate([
    (0, common_1.Get)('me'),
    (0, swagger_1.ApiOperation)({ summary: "Get the caller's current subscription" }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Current subscription (or null if none)' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "findMine", null);
__decorate([
    (0, common_1.Post)(':id/cancel'),
    (0, swagger_1.ApiOperation)({
        summary: 'Cancel a subscription',
        description: 'Access continues until the end of the current billing period.',
    }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Subscription set to cancel at period end' }),
    (0, swagger_1.ApiResponse)({ status: 404, description: 'Subscription not found' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "cancel", null);
__decorate([
    (0, common_1.Get)(),
    (0, common_1.UseGuards)(roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'List all subscriptions (Admin only)' }),
    (0, swagger_1.ApiQuery)({ name: 'status', required: false, enum: client_1.SubscriptionStatus }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'List of subscriptions' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('status')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], SubscriptionsController.prototype, "findAll", null);
exports.SubscriptionsController = SubscriptionsController = __decorate([
    (0, swagger_1.ApiTags)('Subscriptions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('subscriptions'),
    __metadata("design:paramtypes", [subscriptions_service_1.SubscriptionsService,
        subscriptions_checkout_service_1.SubscriptionsCheckoutService])
], SubscriptionsController);
//# sourceMappingURL=subscriptions.controller.js.map