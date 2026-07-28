import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePaypalOrderDto } from './dto/create-paypal-order.dto';
import { CapturePaypalOrderDto } from './dto/webhook.dto';
import { PaypalOrderResult, PaypalCaptureResult, PaypalSubscriptionResult, PaypalWebhookEvent } from './interfaces/payment.interfaces';
export declare const SUBSCRIPTION_LIFECYCLE_EVENT = "billing.subscription.lifecycle";
export declare class PaypalService {
    private readonly config;
    private readonly prisma;
    private readonly eventEmitter;
    private readonly logger;
    private readonly webhookId;
    private readonly returnUrlBase;
    private readonly cancelUrlBase;
    constructor(config: ConfigService, prisma: PrismaService, eventEmitter: EventEmitter2);
    createOrder(dto: CreatePaypalOrderDto): Promise<PaypalOrderResult>;
    captureOrder(dto: CapturePaypalOrderDto, payerId: string): Promise<PaypalCaptureResult>;
    createSubscription(dto: CreatePaypalOrderDto): Promise<PaypalSubscriptionResult>;
    cancelSubscription(providerSubscriptionId: string, note?: string): Promise<void>;
    handleWebhook(body: PaypalWebhookEvent, headers: Record<string, string>): Promise<PaypalWebhookEvent>;
    private verifyWebhookSignature;
    private processWebhookEvent;
    private emitSubscriptionLifecycleEvent;
    private sanitizeWebhookPayload;
    private upsertPaymentRecord;
    private updatePaymentStatusByProviderPaymentId;
}
