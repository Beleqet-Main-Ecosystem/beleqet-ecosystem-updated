import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Result containing market rate and count of contracts.
 */
export interface MarketRateResult {
  averageRate: number | null;
  contractCount: number;
}

/**
 * Helper for calculating market rates from historical contract data.
 */
export class MarketRateHelper {
  /**
   * Computes market rate by averaging agreed amounts from completed contracts in the same category.
   * Uses database-level aggregation to avoid OOM with large datasets.
   * 
   * @param prisma - Prisma service instance
   * @param categoryId - UUID of the freelance job category
   * @returns Object containing average rate and contract count, or null rate if no data exists
   */
  static async computeRate(
    prisma: PrismaService,
    categoryId: string,
  ): Promise<MarketRateResult> {
    const result = await prisma.contract.aggregate({
      where: {
        status: 'COMPLETED',
        freelanceJob: {
          categoryId,
        },
      },
      _avg: {
        agreedAmount: true,
      },
      _count: true,
    });

    return {
      averageRate: result._avg.agreedAmount
        ? Math.round(result._avg.agreedAmount)
        : null,
      contractCount: result._count,
    };
  }
}
