import { WorkerHost } from '@nestjs/bullmq';
import { Job as BullJob, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaWebhookPayload } from '../chapa/chapa.types';
type WebhookPayload = ChapaWebhookPayload;
interface AutoReleasePayload {
    milestoneId: string;
    freelancerId: string;
    amount: number;
    releaseAt: string;
}
interface UnlockFundsPayload {
    escrowId: string;
    clientId: string;
    amount: number;
}
export declare class EscrowProcessor extends WorkerHost {
    private readonly prisma;
    private readonly config;
    private readonly chapaClient;
    private readonly notificationsQueue;
    private readonly escrowQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, chapaClient: ChapaClient, notificationsQueue: Queue, escrowQueue: Queue);
    process(job: BullJob<any, any, string>): Promise<any>;
    handleWebhook(job: BullJob<WebhookPayload>): Promise<void>;
    handleAutoRelease(job: BullJob<AutoReleasePayload>): Promise<void>;
    handleUnlockFunds(job: BullJob<UnlockFundsPayload>): Promise<void>;
    private releaseLockedFunds;
    private processedEventLog;
    private markWebhookProcessed;
    private amountMatches;
    handleJobFailure(job: BullJob | undefined, error: Error): void;
}
export {};
