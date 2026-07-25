export interface BioAnalysis {
  readonly length: number;
  readonly hasPiiWarning: boolean;
  readonly containsRelevantKeywords: boolean;
}

export interface ProfileInsights {
  readonly optimizationScore: number;
  readonly profileCompleteness: number;
  readonly bioAnalysis: BioAnalysis;
  readonly trendingSkillsInMarket: readonly string[];
  readonly suggestedImprovements: readonly string[];
}
