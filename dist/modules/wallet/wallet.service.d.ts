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
    getEmployerWallet(userId: string): Promise<any>;
    getOrCreate(userId: string): Promise<any>;
    private readonly exchangeRates;
    convertCurrency(amount: number, from: string, to: string): number;
    withdraw(userId: string, dto: WithdrawDto): Promise<{
        success: boolean;
        amount: number;
        method: "CHAPA" | "TELEBIRR" | "CBE_BIRR";
        note: string;
    }>;
}
