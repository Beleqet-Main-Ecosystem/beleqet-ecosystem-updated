import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Helper for calculating experience-based multipliers.
 */
export class ExperienceHelper {
  /**
   * Computes experience multiplier based on freelancer's completed contract count.
   * 
   * @param prisma - Prisma service instance
   * @param freelancerId - UUID of the freelancer
   * @returns Multiplier: 0.9x for 0 contracts, 1.0x for 1-4, 1.1x for 5+
   */
  static async computeMultiplier(
    prisma: PrismaService,
    freelancerId: string,
  ): Promise<number> {
    const completedCount = await prisma.contract.count({
      where: {
        freelancerId,
        status: 'COMPLETED',
      },
    });

    if (completedCount === 0) return 0.9;
    if (completedCount >= 5) return 1.1;
    return 1.0;
  }
}
