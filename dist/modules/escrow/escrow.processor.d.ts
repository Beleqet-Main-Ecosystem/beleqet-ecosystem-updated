import { WorkerHost } from '@nestjs/bullmq';
import { Job as BullJob, Queue } from 'bullmq';
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
interface UnlockFundsPayload {
    escrowId: string;
    clientId: string;
    amount: number;
}
interface WithdrawalPayload {
    userId: string;
    amount: number;
    method: string;
    accountRef: string;
}
export declare class EscrowProcessor extends WorkerHost {
    private readonly prisma;
    private readonly config;
    private readonly notificationsQueue;
    private readonly escrowQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, notificationsQueue: Queue, escrowQueue: Queue);
    process(job: BullJob<any, any, string>): Promise<any>;
    handleWebhook(job: BullJob<WebhookPayload>): Promise<void>;
    handleAutoRelease(job: BullJob<AutoReleasePayload>): Promise<void>;
    handleWithdrawal(job: BullJob<WithdrawalPayload>): Promise<void>;
    handleUnlockFunds(job: BullJob<UnlockFundsPayload>): Promise<void>;
    private releaseLockedFunds;
    handleJobFailure(job: BullJob | undefined, error: Error): void;
}
export {};
