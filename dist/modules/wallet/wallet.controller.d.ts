import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { WalletService, WithdrawDto } from './wallet.service';
export declare class WalletController {
    private readonly svc;
    constructor(svc: WalletService);
    getWallet(u: CurrentUserPayload): Promise<any>;
    getEmployerWallet(u: CurrentUserPayload): Promise<any>;
    withdraw(u: CurrentUserPayload, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
