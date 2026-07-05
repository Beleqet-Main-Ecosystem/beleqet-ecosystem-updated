import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Helper for calculating market rates from historical contract data.
 */
export class MarketRateHelper {
  /**
   * Computes market rate by averaging agreed amounts from completed contracts in the same category.
   * 
   * @param prisma - Prisma service instance
   * @param categoryId - UUID of the freelance job category
   * @returns Average agreed amount, or null if no historical data exists (cold start)
   */
  static async computeRate(
    prisma: PrismaService,
    categoryId: string,
  ): Promise<number | null> {
    const contracts = await prisma.contract.findMany({
      where: {
        status: 'COMPLETED',
        freelanceJob: {
          categoryId,
        },
      },
      select: {
        agreedAmount: true,
      },
    });

    if (contracts.length === 0) {
      return null;
    }

    const sum = contracts.reduce(
      (acc: number, c: { agreedAmount: number }) => acc + c.agreedAmount,
      0,
    );
    return Math.round(sum / contracts.length);
  }
}
