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
exports.NotificationsService = void 0;
const common_1 = require("@nestjs/common");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const nestjs_i18n_1 = require("nestjs-i18n");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const notification_types_1 = require("../../common/constants/notification-types");
let NotificationsService = class NotificationsService {
    constructor(prisma, i18n, notificationQueue) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.notificationQueue = notificationQueue;
    }
    async sendInterviewScheduled(interviewId, employerId, candidateId, jobTitle, startTime, endTime, timezone) {
        const [candidate, employer] = await Promise.all([
            this.prisma.user.findUnique({
                where: { id: candidateId },
                select: {
                    email: true,
                    telegramId: true,
                },
            }),
            this.prisma.user.findUnique({
                where: { id: employerId },
                select: {
                    email: true,
                    telegramId: true,
                },
            }),
        ]);
        const title = await this.i18n.translate('interview.notification.scheduledTitle');
        const notificationType = notification_types_1.NOTIFICATION_TYPES.INTERVIEW_SCHEDULED;
        const formattedStart = startTime.toLocaleString('en-US', {
            timeZone: timezone,
        });
        const formattedEnd = endTime.toLocaleString('en-US', {
            timeZone: timezone,
        });
        const candidateBody = await this.i18n.translate('interview.notification.candidateScheduledBody', {
            args: {
                jobTitle: jobTitle,
                startTime: formattedStart,
                endTime: formattedEnd,
                timezone: timezone,
            },
        });
        const employerBody = await this.i18n.translate('interview.notification.employerScheduledBody', {
            args: {
                jobTitle: jobTitle,
                startTime: formattedStart,
                endTime: formattedEnd,
                timezone: timezone,
            },
        });
        const metadata = {
            interviewId,
            jobTitle,
            startTime: formattedStart,
            endTime: formattedEnd,
            timezone,
        };
        await Promise.all([
            this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: candidateId,
                type: notificationType,
                title: title,
                body: candidateBody,
                metadata,
            }),
            this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId: employerId,
                type: notificationType,
                title: title,
                body: employerBody,
                metadata,
            }),
            candidate?.email
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                    to: candidate.email,
                    subject: title,
                    html: `<p>${candidateBody}</p>`,
                })
                : Promise.resolve(),
            employer?.email
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                    to: employer.email,
                    subject: title,
                    html: `<p>${employerBody}</p>`,
                })
                : Promise.resolve(),
            candidate?.telegramId
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                    telegramId: candidate.telegramId,
                    message: candidateBody,
                })
                : Promise.resolve(),
            employer?.telegramId
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                    telegramId: employer.telegramId,
                    message: employerBody,
                })
                : Promise.resolve(),
        ]);
    }
    async sendSubscriptionExpiringSoon(userId, planName, expiresAt) {
        const title = await this.i18n.translate('subscriptions.notification.expiringSoonTitle');
        const body = await this.i18n.translate('subscriptions.notification.expiringSoonBody', {
            args: { planName, expiresAt: expiresAt.toLocaleDateString('en-US') },
        });
        await this.dispatchNotification(userId, notification_types_1.NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRING_SOON, title, body, {
            planName,
            expiresAt: expiresAt.toISOString(),
        });
    }
    async sendSubscriptionExpired(userId, planName) {
        const title = await this.i18n.translate('subscriptions.notification.expiredTitle');
        const body = await this.i18n.translate('subscriptions.notification.expiredBody', {
            args: { planName },
        });
        await this.dispatchNotification(userId, notification_types_1.NOTIFICATION_TYPES.SUBSCRIPTION_EXPIRED, title, body, {
            planName,
        });
    }
    async dispatchNotification(userId, type, title, body, metadata) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true, telegramId: true },
        });
        await Promise.all([
            this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_IN_APP, {
                userId,
                type,
                title,
                body,
                metadata,
            }),
            user?.email
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                    to: user.email,
                    subject: title,
                    html: `<p>${body}</p>`,
                })
                : Promise.resolve(),
            user?.telegramId
                ? this.notificationQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_TELEGRAM, {
                    telegramId: user.telegramId,
                    message: body,
                })
                : Promise.resolve(),
        ]);
    }
};
exports.NotificationsService = NotificationsService;
exports.NotificationsService = NotificationsService = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bullmq_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService,
        bullmq_2.Queue])
], NotificationsService);
//# sourceMappingURL=notifications.service.js.map