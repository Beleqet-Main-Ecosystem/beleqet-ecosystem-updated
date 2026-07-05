import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
export declare class EscrowController {
    private readonly svc;
    private readonly config;
    constructor(svc: EscrowService, config: ConfigService);
    initiate(gigId: string, u: CurrentUserPayload): Promise<{
        escrowId: any;
        checkoutUrl: null;
        grossAmount: any;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay?: undefined;
    } | {
        escrowId: any;
        checkoutUrl: string;
        grossAmount: any;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay: any;
    }>;
    webhook(body: Record<string, unknown>, req: Request & {
        rawBody?: Buffer;
    }, chapaSignature?: string, xChapaSignature?: string): Promise<{
        url: string;
        success?: undefined;
    } | {
        success: boolean;
        url?: undefined;
    }>;
    release(id: string, u: CurrentUserPayload): Promise<{
        success: boolean;
    }>;
}
