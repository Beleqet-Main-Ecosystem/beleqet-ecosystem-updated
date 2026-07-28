import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
interface ReleasePendingPayload {
    walletId: string;
    userId: string;
    amount: number;
    milestoneId?: string;
}
export declare class WalletProcessor extends WorkerHost {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    process(job: Job<ReleasePendingPayload>): Promise<void>;
}
export {};
