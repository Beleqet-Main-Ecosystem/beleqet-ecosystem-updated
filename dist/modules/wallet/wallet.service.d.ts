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
    getOrCreate(userId: string): Promise<{
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
    private readonly exchangeRates;
    convertCurrency(amount: number, from: string, to: string): number;
    withdraw(userId: string, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
