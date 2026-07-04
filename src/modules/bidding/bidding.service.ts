import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

/**
 * Response structure for bid price suggestions.
 */
export interface SuggestBidResponse {
  suggestedPrice: number;
  currency: string;
  rationale: string;
  budgetMin: number;
  budgetMax: number;
}

/**
 * Service providing AI-assisted bid price suggestions for freelancers.
 * Uses an explainable heuristic combining market rates, job budget, and freelancer experience.
 */
@Injectable()
export class BiddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
  ) {}

  /**
   * Suggests a bid price for a freelancer on a specific job.
   * 
   * @param freelancerId - UUID of the freelancer requesting the suggestion
   * @param freelanceJobId - UUID of the job to bid on
   * @returns Price suggestion with rationale and budget constraints
   * @throws NotFoundException if the job doesn't exist
   */
  async suggestPrice(
    freelancerId: string,
    freelanceJobId: string,
  ): Promise<SuggestBidResponse> {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: freelanceJobId },
      select: {
        budgetMin: true,
        budgetMax: true,
        currency: true,
        categoryId: true,
      },
    });

    if (!job) {
      throw new NotFoundException('Freelance job not found');
    }

    const jobBudgetMidpoint = (job.budgetMin + job.budgetMax) / 2;
    const experienceMultiplier = await this.computeExperienceMultiplier(freelancerId);
    const marketRate = await this.computeMarketRate(job.categoryId);

    let suggestedPrice: number;
    let rationale: string;

    if (marketRate === null) {
      // Cold start — no historical data for this category
      suggestedPrice = Math.round(jobBudgetMidpoint * experienceMultiplier);
      rationale = await this.i18n.translate('bidding.rationale.coldStart', {
        args: { experienceMultiplier: experienceMultiplier.toFixed(2) },
      });
    } else {
      // Weighted average: 50% market, 30% budget midpoint, 20% experience-adjusted
      const experienceAdjusted = jobBudgetMidpoint * experienceMultiplier;
      const weightedAvg =
        marketRate * 0.5 +
        jobBudgetMidpoint * 0.3 +
        experienceAdjusted * 0.2;

      suggestedPrice = Math.round(weightedAvg);
      rationale = await this.i18n.translate('bidding.rationale.marketBased', {
        args: {
          marketRate,
          experienceMultiplier: experienceMultiplier.toFixed(2),
        },
      });
    }

    // Clamp to job's stated budget range
    suggestedPrice = Math.max(job.budgetMin, Math.min(job.budgetMax, suggestedPrice));

    return {
      suggestedPrice,
      currency: job.currency,
      rationale,
      budgetMin: job.budgetMin,
      budgetMax: job.budgetMax,
    };
  }

  /**
   * Computes experience multiplier based on freelancer's completed contract count.
   * 
   * @param freelancerId - UUID of the freelancer
   * @returns Multiplier: 0.9x for 0 contracts, 1.0x for 1-4, 1.1x for 5+
   */
  private async computeExperienceMultiplier(freelancerId: string): Promise<number> {
    const completedCount = await this.prisma.contract.count({
      where: {
        freelancerId,
        status: 'COMPLETED',
      },
    });

    if (completedCount === 0) return 0.9;
    if (completedCount >= 5) return 1.1;
    return 1.0;
  }

  /**
   * Computes market rate by averaging agreed amounts from completed contracts in the same category.
   * 
   * @param categoryId - UUID of the freelance job category
   * @returns Average agreed amount, or null if no historical data exists (cold start)
   */
  private async computeMarketRate(categoryId: string): Promise<number | null> {
    const contracts = await this.prisma.contract.findMany({
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

    const sum = contracts.reduce((acc, c) => acc + c.agreedAmount, 0);
    return Math.round(sum / contracts.length);
  }
}
