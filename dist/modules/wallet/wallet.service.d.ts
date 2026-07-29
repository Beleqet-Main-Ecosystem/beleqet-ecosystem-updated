import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
export declare class WithdrawDto {
    amount: number;
    method: 'CHAPA' | 'TELEBIRR' | 'CBE_BIRR';
    accountRef: string;
    currency?: string;
}
export declare class WalletService implements OnModuleInit, OnModuleDestroy {
    private readonly prisma;
    private readonly walletQueue?;
    private readonly logger;
    private fetchInterval?;
    private exchangeRates;
    constructor(prisma: PrismaService, walletQueue?: Queue | undefined);
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
        amountInETB: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        status: string;
        note: string;
    }>;
    private restoreFailedWithdrawal;
}
