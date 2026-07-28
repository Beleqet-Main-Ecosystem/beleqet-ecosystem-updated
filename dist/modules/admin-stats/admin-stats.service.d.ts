import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { I18nService } from 'nestjs-i18n';
export interface PlatformStats {
    totalUsers: number;
    totalRevenue: number;
    activeContracts: number;
    completedJobs: number;
    currency: string;
    message: string;
}
export declare class AdminStatsService {
    private readonly prisma;
    private readonly i18n;
    private readonly walletService;
    constructor(prisma: PrismaService, i18n: I18nService, walletService: WalletService);
    getDashboardStats(query: StatsQueryDto): Promise<PlatformStats>;
}
