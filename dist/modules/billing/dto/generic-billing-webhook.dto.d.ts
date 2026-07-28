import { PaymentProvider } from '@prisma/client';
import { SubscriptionLifecycleEvent } from '../../subscriptions/subscriptions.service';
export declare class GenericBillingWebhookDto {
    gatewayEventId: string;
    provider: PaymentProvider;
    eventType: SubscriptionLifecycleEvent;
    providerSubscriptionId: string;
    amount?: number;
    currency?: string;
    gatewayReference?: string;
    rawPayload?: Record<string, unknown>;
}
