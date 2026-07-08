import { Injectable } from '@nestjs/common';
import { I18nContext, I18nService } from 'nestjs-i18n';

import { PrismaService } from '../../prisma/prisma.service';
import { SuggestBidResponse } from './dto/suggest-bid.dto';
import { BidCalculation, BiddingPricingHelper } from './helpers/bidding-pricing.helper';

/**
 * Provides explainable bid suggestions for freelancers using market history,
 * the job budget range, and the freelancer's completed-contract experience.
 */
@Injectable()
export class BiddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly i18n: I18nService,
    private readonly pricingHelper: BiddingPricingHelper,
  ) {}

  /**
   * Suggests a bid price for a freelancer on a specific freelance job.
   *
   * @param freelancerId - Freelancer UUID requesting the suggestion.
   * @param freelanceJobId - Freelance job UUID to price.
   * @returns A suggested amount, currency, rationale, and the job budget range.
   * @throws NotFoundException When the freelance job does not exist.
   */
  async suggestPrice(freelancerId: string, freelanceJobId: string): Promise<SuggestBidResponse> {
    const pricing = await this.pricingHelper.calculate(freelancerId, freelanceJobId);
    const rationale = await this.buildRationale(this.resolveLanguage(), pricing);

    await this.prisma.bidSuggestion.upsert({
      where: {
        freelanceJobId_freelancerId: {
          freelanceJobId,
          freelancerId,
        },
      },
      update: {
        suggestedAmount: pricing.suggestedPrice,
        currency: pricing.job.currency,
        rationale,
      },
      create: {
        freelanceJobId,
        freelancerId,
        suggestedAmount: pricing.suggestedPrice,
        currency: pricing.job.currency,
        rationale,
      },
    });

    return {
      suggestedPrice: pricing.suggestedPrice,
      currency: pricing.job.currency,
      rationale,
      budgetMin: pricing.job.budgetMin,
      budgetMax: pricing.job.budgetMax,
    };
  }

  /**
   * Builds the localized plain-language explanation for the suggestion.
   *
   * @param lang - Resolved locale code.
   * @param pricing - Pricing calculation data returned by the helper.
   * @returns A localized rationale string.
   */
  private async buildRationale(lang: string, pricing: BidCalculation): Promise<string> {
    if (pricing.marketRate === null) {
      return this.i18n.translate('bidding.rationale.coldStart', { lang });
    }

    return this.i18n.translate('bidding.rationale.marketBased', {
      lang,
      args: {
        count: pricing.marketCount,
        experienceMultiplier: pricing.experienceMultiplier.toFixed(1),
      },
    });
  }

  /**
   * Resolves the active request language from the i18n context.
   *
   * @returns The current locale or `en` when the request context is unavailable.
   */
  private resolveLanguage(): string {
    return I18nContext.current()?.lang ?? 'en';
  }
}
