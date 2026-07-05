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
var PaypalWebhookService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PaypalWebhookService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const bull_1 = require("@nestjs/bull");
const axios_1 = require("axios");
const paypal_auth_service_1 = require("./paypal-auth.service");
const queues_constants_1 = require("../queues/queues.constants");
let PaypalWebhookService = PaypalWebhookService_1 = class PaypalWebhookService {
    constructor(auth, config, paypalQueue) {
        this.auth = auth;
        this.config = config;
        this.paypalQueue = paypalQueue;
        this.logger = new common_1.Logger(PaypalWebhookService_1.name);
    }
    async verifyAndDispatch(req, body) {
        await this.verifySignature(req, body);
        await this.dispatch(body);
    }
    async verifySignature(req, body) {
        const webhookId = this.config.get('PAYPAL_WEBHOOK_ID');
        const isProduction = this.config.get('NODE_ENV') === 'production';
        const transmissionId = req.headers['paypal-transmission-id'];
        const transmissionTime = req.headers['paypal-transmission-time'];
        const certUrl = req.headers['paypal-cert-url'];
        const transmissionSig = req.headers['paypal-transmission-sig'];
        const authAlgo = req.headers['paypal-auth-algo'];
        if (!transmissionId || !certUrl || !transmissionSig || !webhookId) {
            const msg = 'Missing required PayPal webhook verification headers or PAYPAL_WEBHOOK_ID';
            if (isProduction) {
                this.logger.error(msg);
                throw new common_1.UnauthorizedException(msg);
            }
            else {
                this.logger.warn(`[DEV] ${msg} — skipping verification`);
                return;
            }
        }
        const token = await this.auth.getAccessToken();
        const baseUrl = this.auth.getBaseUrl();
        let verificationStatus;
        try {
            const response = await axios_1.default.post(`${baseUrl}/v1/notifications/verify-webhook-signature`, {
                auth_algo: authAlgo,
                cert_url: certUrl,
                transmission_id: transmissionId,
                transmission_sig: transmissionSig,
                transmission_time: transmissionTime,
                webhook_id: webhookId,
                webhook_event: body,
            }, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });
            verificationStatus = response.data.verification_status;
        }
        catch (err) {
            const msg = axios_1.default.isAxiosError(err)
                ? JSON.stringify(err.response?.data)
                : String(err);
            this.logger.error(`PayPal webhook verification API call failed: ${msg}`);
            if (isProduction) {
                throw new common_1.UnauthorizedException('PayPal webhook signature verification failed');
            }
            this.logger.warn('[DEV] Verification API error — proceeding without verification');
            return;
        }
        if (verificationStatus !== 'SUCCESS') {
            this.logger.error(`PayPal webhook signature INVALID for event ${body['id'] ?? '?'} — status: ${verificationStatus}`);
            if (isProduction) {
                throw new common_1.UnauthorizedException('Invalid PayPal webhook signature');
            }
            this.logger.warn('[DEV] Signature mismatch — proceeding in dev mode');
        }
        else {
            this.logger.debug(`PayPal webhook ${body['event_type'] ?? 'UNKNOWN'} verified ✓`);
        }
    }
    async dispatch(body) {
        const eventType = body['event_type'];
        const resource = body['resource'];
        this.logger.log(`Dispatching PayPal webhook event: ${eventType}`);
        const jobOpts = {
            attempts: 3,
            backoff: { type: 'exponential', delay: 3_000 },
            removeOnComplete: 100,
            removeOnFail: 200,
        };
        switch (eventType) {
            case 'PAYMENT.CAPTURE.COMPLETED':
            case 'PAYMENT.CAPTURE.DENIED':
            case 'PAYMENT.CAPTURE.REFUNDED':
                await this.paypalQueue.add(queues_constants_1.PAYPAL_JOBS.PROCESS_WEBHOOK, { eventType, resource }, jobOpts);
                break;
            case 'BILLING.SUBSCRIPTION.ACTIVATED':
            case 'BILLING.SUBSCRIPTION.CANCELLED':
            case 'BILLING.SUBSCRIPTION.SUSPENDED':
            case 'BILLING.SUBSCRIPTION.EXPIRED':
                await this.paypalQueue.add(queues_constants_1.PAYPAL_JOBS.SYNC_SUBSCRIPTION, { eventType, resource }, jobOpts);
                break;
            case 'CUSTOMER.DISPUTE.CREATED':
            case 'CUSTOMER.DISPUTE.RESOLVED':
            case 'CUSTOMER.DISPUTE.UPDATED':
                await this.paypalQueue.add(queues_constants_1.PAYPAL_JOBS.SYNC_DISPUTE, { eventType, resource }, jobOpts);
                break;
            default:
                this.logger.debug(`Unhandled PayPal event type: ${eventType} — ignoring`);
        }
    }
};
exports.PaypalWebhookService = PaypalWebhookService;
exports.PaypalWebhookService = PaypalWebhookService = PaypalWebhookService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bull_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.PAYPAL)),
    __metadata("design:paramtypes", [paypal_auth_service_1.PaypalAuthService,
        config_1.ConfigService, Object])
], PaypalWebhookService);
//# sourceMappingURL=paypal-webhook.service.js.map