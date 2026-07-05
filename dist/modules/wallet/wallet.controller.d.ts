import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { WalletService, WithdrawDto } from './wallet.service';
export declare class WalletController {
    private readonly svc;
    constructor(svc: WalletService);
    getWallet(u: CurrentUserPayload): Promise<{
        transactions: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.WalletTransactionType;
            amount: number;
            note: string | null;
            walletId: string;
            milestoneId: string | null;
        }[];
    } & {
        id: string;
        currency: string;
        updatedAt: Date;
        userId: string;
        pendingBalance: number;
        availableBalance: number;
    }>;
    getEmployerWallet(u: CurrentUserPayload): Promise<{
        transactions: {
            id: string;
            createdAt: Date;
            type: import(".prisma/client").$Enums.WalletTransactionType;
            amount: number;
            note: string | null;
            escrowId: string | null;
            walletId: string;
        }[];
    } & {
        id: string;
        currency: string;
        updatedAt: Date;
        userId: string;
        balance: number;
        lockedBalance: number;
    }>;
    withdraw(u: CurrentUserPayload, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
