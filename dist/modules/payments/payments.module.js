"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaymentsModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_module_1 = require("../../prisma/prisma.module");
const stripe_service_1 = require("./stripe.service");
const paypal_service_1 = require("./paypal.service");
const payments_controller_1 = require("./payments.controller");
let PaymentsModule = class PaymentsModule {
};
exports.PaymentsModule = PaymentsModule;
exports.PaymentsModule = PaymentsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            config_1.ConfigModule,
            prisma_module_1.PrismaModule,
        ],
        controllers: [
            payments_controller_1.StripeController,
            payments_controller_1.StripeWebhookController,
            payments_controller_1.PaypalController,
            payments_controller_1.PaypalWebhookController,
        ],
        providers: [stripe_service_1.StripeService, paypal_service_1.PaypalService],
        exports: [stripe_service_1.StripeService, paypal_service_1.PaypalService],
    })
], PaymentsModule);
//# sourceMappingURL=payments.module.js.map