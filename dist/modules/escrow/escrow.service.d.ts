import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
export declare class EscrowService {
    private readonly prisma;
    private readonly config;
    private readonly walletSvc;
    private readonly escrowQueue;
    private readonly eventEmitter;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, walletSvc: WalletService, escrowQueue: Queue, eventEmitter: EventEmitter2);
    initiate(clientId: string, freelanceJobId: string): Promise<{
        escrowId: string;
        checkoutUrl: null;
        grossAmount: number;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay?: undefined;
    } | {
        escrowId: string;
        checkoutUrl: string;
        grossAmount: number;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay: number;
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
