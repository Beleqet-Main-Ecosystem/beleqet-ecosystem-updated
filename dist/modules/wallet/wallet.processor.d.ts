import { WorkerHost } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { ChapaClient } from '../chapa/chapa.client';
interface ReleasePendingPayload {
    walletId: string;
    userId: string;
    amount: number;
    milestoneId?: string;
}
interface ProcessWithdrawalPayload {
    withdrawalTxId: string;
    userId: string;
    walletId: string;
    requestedAmount: number;
    requestedCurrency: string;
    walletAmount: number;
    payoutAmount: number;
    payoutCurrency: 'ETB';
    method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';
    accountRef: string;
}
type WalletJobPayload = ReleasePendingPayload | ProcessWithdrawalPayload;
export declare class WalletProcessor extends WorkerHost {
    private readonly prisma;
    private readonly config;
    private readonly chapaClient;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, chapaClient: ChapaClient);
    process(job: Job<WalletJobPayload>): Promise<void>;
    private releasePending;
    private processWithdrawal;
    private claimWithdrawalForProcessing;
    private reconcileSubmittedWithdrawal;
    private markWithdrawalSubmitted;
    private restoreRejectedWithdrawal;
    private processingNote;
    private isWithdrawalFinalized;
}
export {};
