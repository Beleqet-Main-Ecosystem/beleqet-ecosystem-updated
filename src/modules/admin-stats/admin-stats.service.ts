import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';
import { StatsQueryDto } from './dto/stats-query.dto';
import { I18nService } from 'nestjs-i18n';

/**
 * Aggregated platform statistics returned to the admin dashboard.
 */
export interface PlatformStats {
  totalUsers: number;
  totalRevenue: number;
  activeContracts: number;
  completedJobs: number;
  currency: string;
  message: string;
}

/**
 * Aggregates admin dashboard metrics from the platform data store.
 */
@Injectable()
export class AdminStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly walletService: WalletService,
  ) { }

  /**
   * Returns the main platform metrics for the admin dashboard.
   * The response excludes personal data and uses the requested currency.
   */
  async getDashboardStats(query: StatsQueryDto): Promise<PlatformStats> {
    const targetCurrency = query.currency || 'ETB';
    const lang = query.lang || 'en';

    // Aggregate users (GDPR compliant: only count, no PII)
    const totalUsers = await this.prisma.user.count({
      where: { isActive: true },
    });

    // Aggregate active contracts
    const activeContracts = await this.prisma.contract.count({
      where: { status: 'ACTIVE' },
    });

    // Aggregate completed jobs
    const completedJobs = await this.prisma.freelanceJob.count({
      where: { status: 'COMPLETED' },
    });

    // Aggregate revenue (simplified: summing up Escrow net amounts)
    const escrowTransactions = await this.prisma.escrowTransaction.findMany({
      where: { status: 'RELEASED' },
      select: { netAmount: true, currency: true },
    });

    let totalRevenue = 0;
    for (const tx of escrowTransactions) {
      const amount = tx.netAmount || 0;
      const currency = tx.currency || 'ETB';
      try {
        totalRevenue += this.walletService.convertCurrency(amount, currency, targetCurrency);
      } catch (error) {
        // If conversion rate is unsupported, fallback to 1:1 or ignore
        totalRevenue += amount;
      }
    }

    // Retrieve translated message using i18n
    const translatedMessage = this.i18n.t('admin-stats.DASHBOARD_TITLE', { lang, defaultValue: 'Dashboard Statistics' });

    return {
      totalUsers,
      totalRevenue,
      activeContracts,
      completedJobs,
      currency: targetCurrency,
      message: typeof translatedMessage === 'string' ? translatedMessage : 'Dashboard Statistics',
    };
  }
}
