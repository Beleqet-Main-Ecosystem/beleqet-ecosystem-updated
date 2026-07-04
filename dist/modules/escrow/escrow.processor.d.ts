import { Job as BullJob } from 'bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
interface WebhookPayload {
    reference: string;
    status: string;
    amount?: number;
    currency?: string;
    tx_ref?: string;
    [key: string]: unknown;
}
interface AutoReleasePayload {
    milestoneId: string;
    freelancerId: string;
    amount: number;
    releaseAt: string;
}
interface WithdrawalPayload {
    walletId: string;
    userId: string;
    amount: number;
    method: string;
    accountRef: string;
}
export declare class EscrowProcessor {
    private readonly prisma;
    private readonly config;
    private readonly notificationsQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, notificationsQueue: Queue);
    handleWebhook(job: BullJob<WebhookPayload>): Promise<void>;
    handleAutoRelease(job: BullJob<AutoReleasePayload>): Promise<void>;
    handleWithdrawal(job: BullJob<WithdrawalPayload>): Promise<void>;
    onFailed(job: BullJob, error: Error): void;
}
export {};
