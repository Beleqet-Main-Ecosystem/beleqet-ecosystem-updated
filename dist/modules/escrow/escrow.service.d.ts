import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { ChapaClient } from '../chapa/chapa.client';
import { ChapaWebhookPayload } from '../chapa/chapa.types';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';
export declare class EscrowService {
    private readonly prisma;
    private readonly config;
    private readonly walletSvc;
    private readonly chapaClient;
    private readonly escrowQueue;
    private readonly eventEmitter;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, walletSvc: WalletService, chapaClient: ChapaClient, escrowQueue: Queue, eventEmitter: EventEmitter2);
    initiate(clientId: string, freelanceJobId: string): Promise<{
        escrowId: string;
        checkoutUrl: string | null;
        grossAmount: number;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay: number;
    }>;
    handleWebhook(payload: ChapaWebhookPayload): Promise<{
        queued: boolean;
        eventKey: string;
    }>;
    confirmMilestone(milestoneId: string, userId: string, _dto?: ConfirmMilestoneDto): Promise<{
        success: boolean;
        released: boolean;
        alreadyReleased: boolean;
    } | {
        success: boolean;
        released: boolean;
        alreadyReleased?: undefined;
    } | {
        success: boolean;
        released: boolean;
        waitingFor: string;
    }>;
    releaseMilestone(milestoneId: string, clientId: string): Promise<{
        success: boolean;
        released: boolean;
        alreadyReleased: boolean;
    } | {
        success: boolean;
        released: boolean;
        alreadyReleased?: undefined;
    } | {
        success: boolean;
        released: boolean;
        waitingFor: string;
    }>;
    private recordMilestoneConfirmation;
    private queueMilestoneRelease;
    private netMilestoneAmountInETB;
    private enqueueMilestoneAutoRelease;
}
