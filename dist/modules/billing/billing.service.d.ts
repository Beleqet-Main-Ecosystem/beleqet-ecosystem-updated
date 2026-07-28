import { ConfigService } from '@nestjs/config';
import { SubscriptionsService, SyncFromProviderEventInput } from '../subscriptions/subscriptions.service';
import { WalletService } from '../wallet/wallet.service';
import { GenericBillingWebhookDto } from './dto/generic-billing-webhook.dto';
export declare class BillingService {
    private readonly subscriptionsService;
    private readonly walletService;
    private readonly config;
    private readonly logger;
    private readonly webhookSecret;
    constructor(subscriptionsService: SubscriptionsService, walletService: WalletService, config: ConfigService);
    handleSubscriptionLifecycleEvent(payload: SyncFromProviderEventInput): Promise<void>;
    convertToPlanCurrency(amount: number, from: string, to: string): number;
    handleGenericWebhook(dto: GenericBillingWebhookDto, rawBody: Buffer, signature: string | undefined): Promise<void>;
    private verifySignature;
}
