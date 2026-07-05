import { Request } from 'express';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PaypalOrderService } from './paypal-order.service';
import { PaypalSubscriptionService } from './paypal-subscription.service';
import { PaypalWebhookService } from './paypal-webhook.service';
import { PaypalDisputeService } from './paypal-dispute.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { RefundDto } from './dto/refund.dto';
export declare class PaypalController {
    private readonly orderSvc;
    private readonly subscriptionSvc;
    private readonly webhookSvc;
    private readonly disputeSvc;
    constructor(orderSvc: PaypalOrderService, subscriptionSvc: PaypalSubscriptionService, webhookSvc: PaypalWebhookService, disputeSvc: PaypalDisputeService);
    createOrder(user: CurrentUserPayload, dto: CreateOrderDto): Promise<{
        transactionId: any;
        orderId: string;
        approveUrl: string;
        amount: number;
        currency: string;
        platformFee: number;
    }>;
    captureOrder(user: CurrentUserPayload, orderId: string): Promise<{
        status: string;
        captureId: any;
        transactionId: any;
        orderId?: undefined;
        amount?: undefined;
        currency?: undefined;
    } | {
        transactionId: any;
        orderId: string;
        captureId: string;
        status: string;
        amount: any;
        currency: any;
    }>;
    createSubscription(user: CurrentUserPayload, dto: CreateSubscriptionDto): Promise<{
        localId: any;
        subscriptionId: string;
        approveUrl: string;
        planId: string;
        planLabel: string | undefined;
    }>;
    suspendSubscription(user: CurrentUserPayload, subscriptionId: string): Promise<any>;
    cancelSubscription(user: CurrentUserPayload, subscriptionId: string): Promise<any>;
    refund(user: CurrentUserPayload, captureId: string, dto: RefundDto): Promise<{
        transactionId: any;
        captureId: string;
        refundId: string;
        refundStatus: string;
        newTxStatus: string;
        refundedAmount: number;
    }>;
    webhook(req: Request & {
        rawBody?: Buffer;
    }, body: Record<string, unknown>): Promise<{
        received: boolean;
    }>;
    health(): {
        module: string;
        status: string;
    };
}
