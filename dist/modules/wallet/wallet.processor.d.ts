import { Job as BullJob } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
interface ReleasePendingPayload {
    walletId: string;
    userId: string;
    amount: number;
    milestoneId?: string;
}
export declare class WalletProcessor {
    private readonly prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    handleReleasePending(job: BullJob<ReleasePendingPayload>): Promise<void>;
}
export {};
