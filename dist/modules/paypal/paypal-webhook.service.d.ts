import { ConfigService } from '@nestjs/config';
import { Queue } from 'bull';
import { Request } from 'express';
import { PaypalAuthService } from './paypal-auth.service';
export declare class PaypalWebhookService {
    private readonly auth;
    private readonly config;
    private readonly paypalQueue;
    private readonly logger;
    constructor(auth: PaypalAuthService, config: ConfigService, paypalQueue: Queue);
    verifyAndDispatch(req: Request & {
        rawBody?: Buffer;
    }, body: Record<string, unknown>): Promise<void>;
    verifySignature(req: Request & {
        rawBody?: Buffer;
    }, body: Record<string, unknown>): Promise<void>;
    private dispatch;
}
