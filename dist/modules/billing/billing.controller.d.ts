import { Request } from 'express';
import { BillingService } from './billing.service';
import { GenericBillingWebhookDto } from './dto/generic-billing-webhook.dto';
export declare class BillingController {
    private readonly billingService;
    constructor(billingService: BillingService);
    handleWebhook(req: Request & {
        rawBody?: Buffer;
    }, dto: GenericBillingWebhookDto, signature: string): Promise<void>;
}
