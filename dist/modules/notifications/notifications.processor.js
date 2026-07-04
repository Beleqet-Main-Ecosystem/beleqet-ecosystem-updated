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
var NotificationsProcessor_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsProcessor = void 0;
const bull_1 = require("@nestjs/bull");
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const nodemailer = require("nodemailer");
let NotificationsProcessor = NotificationsProcessor_1 = class NotificationsProcessor {
    constructor(prisma, config) {
        this.prisma = prisma;
        this.config = config;
        this.logger = new common_1.Logger(NotificationsProcessor_1.name);
        this.transporter = nodemailer.createTransport({
            host: this.config.get('SMTP_HOST'),
            port: this.config.get('SMTP_PORT'),
            auth: {
                user: this.config.get('SMTP_USER'),
                pass: this.config.get('SMTP_PASSWORD') ?? this.config.get('SMTP_PASS'),
            },
            secure: this.config.get('SMTP_SECURE', 'false') === 'true',
        });
    }
    async sendInApp(job) {
        const { userId, type, title, body, metadata } = job.data;
        if (!userId)
            return;
        await this.prisma.notification.create({
            data: {
                userId,
                type,
                title,
                body,
                channel: 'IN_APP',
                metadata: metadata,
            },
        });
        this.logger.debug(`In-app → ${userId}: ${title}`);
    }
    async sendTelegram(job) {
        const botToken = this.config.get('TELEGRAM_BOT_TOKEN');
        if (!botToken)
            return;
        try {
            await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: job.data.telegramId,
                    text: job.data.message,
                    parse_mode: 'Markdown',
                }),
            });
            this.logger.debug(`Telegram → ${job.data.telegramId}`);
        }
        catch (e) {
            this.logger.warn(`Telegram failed: ${e.message}`);
        }
    }
    async sendEmail(job) {
        const { to, subject, html, text } = job.data;
        if (!to)
            return;
        try {
            await this.transporter.sendMail({
                from: this.config.get('SMTP_FROM') ??
                    this.config.get('EMAIL_FROM', 'Beleqet <noreply@beleqet.com>'),
                to,
                subject,
                html,
                text,
            });
            this.logger.debug(`Email → ${to}: ${subject}`);
        }
        catch (e) {
            this.logger.warn(`Email failed: ${e.message}`);
        }
    }
};
exports.NotificationsProcessor = NotificationsProcessor;
__decorate([
    (0, bull_1.Process)(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsProcessor.prototype, "sendInApp", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsProcessor.prototype, "sendTelegram", null);
__decorate([
    (0, bull_1.Process)(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsProcessor.prototype, "sendEmail", null);
exports.NotificationsProcessor = NotificationsProcessor = NotificationsProcessor_1 = __decorate([
    (0, common_1.Injectable)(),
    (0, bull_1.Processor)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService])
], NotificationsProcessor);
//# sourceMappingURL=notifications.processor.js.map