export class SuggestionBreakdown {
  marketBaseline: number;
  experienceAdjustment: number;
  skillMatchAdjustment: number;
  complexityAdjustment: number;
  explanationEn: string;
  explanationAm: string;
}

export class PredictBidResponseDto {
  recommendedBidAmount: number;
  minSuggestedBid: number;
  maxSuggestedBid: number;
  currency: string;
  confidenceScore: number;
  estimatedTimelineDays: number;
  breakdown: SuggestionBreakdown;
  aiModelUsed: string;
  cached: boolean;
}
