import { Job } from 'bull';
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
export declare class NotificationsProcessor {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private readonly transporter;
    constructor(prisma: PrismaService, config: ConfigService);
    sendInApp(job: Job<InAppPayload>): Promise<void>;
    sendTelegram(job: Job<TelegramPayload>): Promise<void>;
    sendEmail(job: Job<EmailPayload>): Promise<void>;
}
export {};
