import { Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { ExperienceHelper } from './experience.helper';
import { MarketRateHelper } from './market-rate.helper';

export type BidJobSnapshot = {
  budgetMin: number;
  budgetMax: number;
  currency: string;
  categoryId: string;
};

export type BidCalculation = {
  job: BidJobSnapshot;
  marketRate: number | null;
  marketCount: number;
  experienceMultiplier: number;
  suggestedPrice: number;
};

/**
 * Calculates the bid-suggestion inputs and final suggested price.
 */
@Injectable()
export class BiddingPricingHelper {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Loads the job and computes the pricing inputs needed by the bidding service.
   *
   * @param freelancerId - Freelancer UUID.
   * @param freelanceJobId - Freelance job UUID.
   * @returns The job snapshot and the computed pricing factors.
   */
  async calculate(freelancerId: string, freelanceJobId: string): Promise<BidCalculation> {
    const job = await this.loadJob(freelanceJobId);
    const marketRateResult = await MarketRateHelper.computeRate(this.prisma, job.categoryId);
    const experienceMultiplier = await ExperienceHelper.computeMultiplier(
      this.prisma,
      freelancerId,
    );
    const budgetMidpoint = (job.budgetMin + job.budgetMax) / 2;
    const suggestedPrice = this.clamp(
      marketRateResult.averageRate === null
        ? Math.round(budgetMidpoint)
        : Math.round(
            marketRateResult.averageRate * 0.5 +
              budgetMidpoint * 0.3 +
              budgetMidpoint * experienceMultiplier * 0.2,
          ),
      job.budgetMin,
      job.budgetMax,
    );

    return {
      job,
      marketRate: marketRateResult.averageRate,
      marketCount: marketRateResult.contractCount,
      experienceMultiplier,
      suggestedPrice,
    };
  }

  /**
   * Loads the pricing fields for a freelance job.
   */
  private async loadJob(freelanceJobId: string): Promise<BidJobSnapshot> {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: freelanceJobId },
      select: { budgetMin: true, budgetMax: true, currency: true, categoryId: true },
    });

    if (!job) {
      throw new NotFoundException('Freelance job not found');
    }

    return job;
  }

  /**
   * Keeps the suggestion within the job budget.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
}
