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
var AlertingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertingService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const queues_constants_1 = require("../queues/queues.constants");
const config_1 = require("@nestjs/config");
const escapeHtml = (unsafe) => {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};
let AlertingService = AlertingService_1 = class AlertingService {
    constructor(notificationsQueue, config) {
        this.notificationsQueue = notificationsQueue;
        this.config = config;
        this.logger = new common_1.Logger(AlertingService_1.name);
        this.slackWebhookUrl = this.config.get('SLACK_WEBHOOK_URL') || '';
    }
    async dispatchAlert(payload) {
        try {
            await Promise.all([this.sendEmailAlert(payload), this.sendSlackAlert(payload)]);
        }
        catch (error) {
            this.logger.error(`Failed to dispatch alert: ${error.message}`);
        }
    }
    async sendEmailAlert(payload) {
        const adminEmail = this.config.get('SECURITY_ADMIN_EMAIL') || 'security@beleqet.com';
        await this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
            to: adminEmail,
            subject: `[${escapeHtml(payload.severity)}] Beleqet Anomaly Detected: ${escapeHtml(payload.title)}`,
            html: `<p><strong>Anomaly Detected</strong></p>
             <p><strong>Title:</strong> ${escapeHtml(payload.title)}</p>
             <p><strong>Severity:</strong> ${escapeHtml(payload.severity)}</p>
             <p><strong>Time:</strong> ${escapeHtml(payload.timestamp)}</p>
             <p><strong>Details:</strong> ${escapeHtml(payload.message)}</p>`,
        });
        this.logger.debug(`Email alert queued for ${adminEmail}`);
    }
    async sendSlackAlert(payload) {
        if (!this.slackWebhookUrl) {
            this.logger.debug('Slack Webhook URL is not configured; skipping Slack alert.');
            return;
        }
        try {
            const color = payload.severity === 'CRITICAL'
                ? '#FF0000'
                : payload.severity === 'HIGH'
                    ? '#FFA500'
                    : '#FFFF00';
            const response = await fetch(this.slackWebhookUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    attachments: [
                        {
                            color,
                            title: `[${payload.severity}] ${payload.title}`,
                            text: payload.message,
                            footer: `Detected at ${payload.timestamp}`,
                        },
                    ],
                }),
            });
            if (!response.ok) {
                this.logger.warn(`Failed to send Slack alert. Slack returned status ${response.status}: ${await response.text()}`);
            }
            else {
                this.logger.debug('Slack alert sent.');
            }
        }
        catch (error) {
            this.logger.warn(`Failed to send Slack alert: ${error.message}`);
        }
    }
};
exports.AlertingService = AlertingService;
exports.AlertingService = AlertingService = AlertingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [Object, config_1.ConfigService])
], AlertingService);
//# sourceMappingURL=alerting.service.js.map