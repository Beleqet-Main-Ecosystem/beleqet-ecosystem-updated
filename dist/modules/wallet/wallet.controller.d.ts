import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { WalletService, WithdrawDto } from './wallet.service';
export declare class WalletController {
    private readonly svc;
    constructor(svc: WalletService);
    getWallet(u: CurrentUserPayload): Promise<{
        transactions: {
            type: import(".prisma/client").$Enums.WalletTransactionType;
            id: string;
            note: string | null;
            createdAt: Date;
            amount: number;
            walletId: string;
            milestoneId: string | null;
        }[];
    } & {
        id: string;
        updatedAt: Date;
        userId: string;
        currency: string;
        pendingBalance: number;
        availableBalance: number;
    }>;
    getEmployerWallet(u: CurrentUserPayload): Promise<{
        transactions: {
            type: import(".prisma/client").$Enums.WalletTransactionType;
            id: string;
            note: string | null;
            createdAt: Date;
            amount: number;
            escrowId: string | null;
            walletId: string;
        }[];
    } & {
        id: string;
        updatedAt: Date;
        userId: string;
        currency: string;
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
