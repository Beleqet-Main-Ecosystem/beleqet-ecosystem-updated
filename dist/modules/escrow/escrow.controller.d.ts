import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { ChapaSignatureService } from './chapa-signature.service';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';
export declare class EscrowController {
    private readonly svc;
    private readonly config;
    private readonly signatures;
    constructor(svc: EscrowService, config: ConfigService, signatures: ChapaSignatureService);
    initiate(gigId: string, u: CurrentUserPayload): Promise<{
        escrowId: string;
        checkoutUrl: string | null;
        grossAmount: number;
        platformFee: number;
        netAmount: number;
        walletAppliedAmount: number;
        amountToPay: number;
    }>;
    webhook(body: Record<string, unknown>, req: Request & {
        rawBody?: Buffer;
    }, headers: Record<string, string | string[] | undefined>, chapaSignature?: string, xChapaSignature?: string): Promise<{
        url: string;
        success?: undefined;
    } | {
        success: boolean;
        url?: undefined;
    }>;
    release(id: string, u: CurrentUserPayload): Promise<{
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
    confirm(id: string, u: CurrentUserPayload, body: ConfirmMilestoneDto): Promise<{
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
}
