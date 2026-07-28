import { WorkerHost } from '@nestjs/bullmq';
import { Job as BullMQJob } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
interface InAppPayload {
    userId: string;
    type: string;
    title: string;
    body: string;
    metadata?: object;
}
interface TelegramPayload {
    telegramId: string;
    message: string;
}
export interface EmailPayload {
    to: string;
    subject: string;
    html: string;
    text?: string;
}
export declare class NotificationsProcessor extends WorkerHost {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private readonly transporter;
    constructor(prisma: PrismaService, config: ConfigService);
    process(job: BullMQJob<any, any, string>): Promise<any>;
    sendInApp(job: BullMQJob<InAppPayload>): Promise<void>;
    sendTelegram(job: BullMQJob<TelegramPayload>): Promise<void>;
    sendEmail(job: BullMQJob<EmailPayload>): Promise<void>;
}
export {};
