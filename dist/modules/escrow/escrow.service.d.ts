import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
export declare class EscrowService {
    private readonly prisma;
    private readonly config;
    private readonly walletSvc;
    private readonly escrowQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, walletSvc: WalletService, escrowQueue: Queue);
    initiate(clientId: string, freelanceJobId: string): Promise<{
        escrowId: any;
        checkoutUrl: null;
        grossAmount: any;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay?: undefined;
    } | {
        escrowId: any;
        checkoutUrl: string;
        grossAmount: any;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay: any;
    }>;
    handleWebhook(payload: {
        reference: string;
        status: string;
        [k: string]: unknown;
    }): Promise<void>;
    releaseMilestone(milestoneId: string, clientId: string): Promise<{
        success: boolean;
    }>;
}
