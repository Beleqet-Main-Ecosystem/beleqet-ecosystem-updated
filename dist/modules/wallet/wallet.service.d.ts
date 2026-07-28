import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
export declare class WithdrawDto {
    amount: number;
    method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';
    accountRef: string;
    currency?: string;
}
export declare class WalletService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly config;
    private readonly logger;
    private fetchInterval?;
    private exchangeRates;
    constructor(prisma: PrismaService, config: ConfigService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): void;
    private fetchLiveRates;
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
        userId: string;
        updatedAt: Date;
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
        userId: string;
        updatedAt: Date;
        currency: string;
        pendingBalance: number;
        availableBalance: number;
    }>;
    convertCurrency(amount: number, from: string, to: string): number;
    withdraw(userId: string, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
