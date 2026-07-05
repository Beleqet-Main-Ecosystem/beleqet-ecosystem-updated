import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalAuthService } from './paypal-auth.service';
import { RefundDto } from './dto/refund.dto';
export declare class PaypalDisputeService {
    private readonly prisma;
    private readonly auth;
    private readonly config;
    private readonly paypalQueue;
    private readonly logger;
    constructor(prisma: PrismaService, auth: PaypalAuthService, config: ConfigService, paypalQueue: Queue);
    refund(captureId: string, clientId: string, dto: RefundDto): Promise<{
        transactionId: any;
        captureId: string;
        refundId: string;
        refundStatus: string;
        newTxStatus: string;
        refundedAmount: number;
    }>;
    upsertDispute(payload: {
        dispute_id: string;
        reason: string;
        status: string;
        dispute_outcome?: {
            outcome_code?: string;
        };
        create_time: string;
        update_time?: string;
        dispute_transactions?: {
            buyer_transaction_id?: string;
        }[];
        [key: string]: unknown;
    }): Promise<any>;
    private mapDisputeStatus;
}
