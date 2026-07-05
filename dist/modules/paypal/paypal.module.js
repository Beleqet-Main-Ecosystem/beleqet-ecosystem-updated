"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalModule = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const queues_constants_1 = require("../queues/queues.constants");
const paypal_controller_1 = require("./paypal.controller");
const paypal_auth_service_1 = require("./paypal-auth.service");
const paypal_order_service_1 = require("./paypal-order.service");
const paypal_subscription_service_1 = require("./paypal-subscription.service");
const paypal_webhook_service_1 = require("./paypal-webhook.service");
const paypal_dispute_service_1 = require("./paypal-dispute.service");
const paypal_processor_1 = require("./paypal.processor");
const paypal_i18n_service_1 = require("./paypal-i18n.service");
let PaypalModule = class PaypalModule {
};
exports.PaypalModule = PaypalModule;
exports.PaypalModule = PaypalModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bull_1.BullModule.registerQueue({ name: queues_constants_1.QUEUE_NAMES.PAYPAL }, { name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS }),
        ],
        providers: [
            paypal_auth_service_1.PaypalAuthService,
            paypal_order_service_1.PaypalOrderService,
            paypal_subscription_service_1.PaypalSubscriptionService,
            paypal_webhook_service_1.PaypalWebhookService,
            paypal_dispute_service_1.PaypalDisputeService,
            paypal_processor_1.PaypalProcessor,
            paypal_i18n_service_1.PaypalI18nService,
        ],
        controllers: [paypal_controller_1.PaypalController],
        exports: [
            paypal_auth_service_1.PaypalAuthService,
            paypal_order_service_1.PaypalOrderService,
            paypal_subscription_service_1.PaypalSubscriptionService,
            paypal_dispute_service_1.PaypalDisputeService,
            paypal_i18n_service_1.PaypalI18nService,
        ],
    })
], PaypalModule);
//# sourceMappingURL=paypal.module.js.map