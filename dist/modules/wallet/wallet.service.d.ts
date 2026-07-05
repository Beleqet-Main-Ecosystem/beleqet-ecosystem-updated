import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class WithdrawDto {
    amount: number;
    method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';
    accountRef: string;
    currency?: string;
}
export declare class WalletService {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService);
    getEmployerWallet(userId: string): Promise<{
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
    getOrCreate(userId: string): Promise<{
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
    private readonly exchangeRates;
    convertCurrency(amount: number, from: string, to: string): number;
    withdraw(userId: string, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
