import { Queue } from 'bullmq';
import { I18nService } from 'nestjs-i18n';
import { PrismaService } from '../../prisma/prisma.service';
export declare class NotificationsService {
    private readonly prisma;
    private readonly i18n;
    private readonly notificationQueue;
    constructor(prisma: PrismaService, i18n: I18nService, notificationQueue: Queue);
    sendInterviewScheduled(interviewId: string, employerId: string, candidateId: string, jobTitle: string, startTime: Date, endTime: Date, timezone: string): Promise<void>;
    sendSubscriptionExpiringSoon(userId: string, planName: string, expiresAt: Date): Promise<void>;
    sendSubscriptionExpired(userId: string, planName: string): Promise<void>;
    private dispatchNotification;
}
