import { Job as BullJob } from 'bull';
import { Queue } from 'bull';
import { PrismaService } from '../../prisma/prisma.service';
import { PaypalDisputeService } from './paypal-dispute.service';
import { PaypalI18nService } from './paypal-i18n.service';
interface CaptureWebhookPayload {
    eventType: string;
    resource: {
        id: string;
        status: string;
        amount?: {
            value: string;
            currency_code: string;
        };
        supplementary_data?: {
            related_ids?: {
                order_id?: string;
            };
        };
        [key: string]: unknown;
    };
}
interface SubscriptionWebhookPayload {
    eventType: string;
    resource: {
        id: string;
        status: string;
        billing_info?: {
            next_billing_time?: string;
        };
        start_time?: string;
        [key: string]: unknown;
    };
}
interface DisputeWebhookPayload {
    eventType: string;
    resource: {
        dispute_id: string;
        reason: string;
        status: string;
        create_time: string;
        update_time?: string;
        dispute_outcome?: {
            outcome_code?: string;
        };
        dispute_transactions?: {
            buyer_transaction_id?: string;
        }[];
        [key: string]: unknown;
    };
}
export declare class PaypalProcessor {
    private readonly prisma;
    private readonly disputeService;
    private readonly i18n;
    private readonly notificationsQueue;
    private readonly logger;
    constructor(prisma: PrismaService, disputeService: PaypalDisputeService, i18n: PaypalI18nService, notificationsQueue: Queue);
    handleCaptureWebhook(job: BullJob<CaptureWebhookPayload>): Promise<void>;
    handleSubscriptionWebhook(job: BullJob<SubscriptionWebhookPayload>): Promise<void>;
    handleDisputeWebhook(job: BullJob<DisputeWebhookPayload>): Promise<void>;
    onFailed(job: BullJob, error: Error): void;
}
export {};
