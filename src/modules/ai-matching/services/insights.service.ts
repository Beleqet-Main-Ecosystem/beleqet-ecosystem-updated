import { Inject, Injectable, Logger } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.token';
import type { LlmProvider } from './llm-provider.token';
import { PromptService } from './prompt.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { safeJsonParse } from '../utils/json-parser.util';

interface BioAnalysis {
  readonly length: number;
  readonly hasPiiWarning: boolean;
  readonly containsRelevantKeywords: boolean;
}

interface ProfileInsights {
  readonly optimizationScore: number;
  readonly profileCompleteness: number;
  readonly bioAnalysis: BioAnalysis;
  readonly trendingSkillsInMarket: readonly string[];
  readonly suggestedImprovements: readonly string[];
}

interface LlmInsightsRaw {
  optimizationScore?: number;
  bioQuality?: string;
  containsRelevantKeywords?: boolean;
  suggestedImprovements?: string[];
  trendingSkillsInMarket?: string[];
}

const PII_EMAIL = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const PII_PHONE = /\+?\d{1,4}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,4}/;
const RELEVANCE_KEYWORDS = [
  'react',
  'node',
  'typescript',
  'python',
  'docker',
  'api',
  'frontend',
  'backend',
  'fullstack',
  'aws',
  'sql',
];

/**
 * Generates AI-powered profile insights for freelancers.
 *
 * Uses the LLM to analyze profile data and generate optimization scores,
 * suggestions, and trending skills. Falls back to rule-based analysis
 * if the LLM is unavailable or returns invalid data.
 */
@Injectable()
export class InsightsService {
  private readonly logger = new Logger(InsightsService.name);

  constructor(
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
    private readonly promptService: PromptService,
    private readonly prisma: PrismaService,
  ) {}

  async getInsights(user: {
    id: string;
    headline: string | null;
    bio: string | null;
    skills: readonly string[];
    githubUrl: string | null;
    linkedinUrl: string | null;
    portfolioUrl: string | null;
    defaultResumeUrl?: string | null;
  }): Promise<ProfileInsights> {
    const marketSkills = await this.getMarketTrendingSkills();

    try {
      const prompt = this.promptService.buildInsightsPrompt(user);
      const raw = await this.llmProvider.generate(prompt);
      const parsed = safeJsonParse<LlmInsightsRaw>(raw);

      if (parsed && typeof parsed.optimizationScore === 'number') {
        return this.buildFromLlm(user, parsed, marketSkills);
      }
    } catch (error) {
      this.logger.warn(
        `LLM insights failed for ${user.id}, falling back to rules: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }

    return this.buildFromRules(user, marketSkills);
  }

  /**
   * Query the database for the most frequently required skills across recent job postings.
   * Combines freelance jobs (skills array) and board jobs (tags array).
   * Returns up to 10 most common skills.
   */
  private async getMarketTrendingSkills(): Promise<readonly string[]> {
    try {
      const freelanceJobs = await this.prisma.freelanceJob.findMany({
        select: { skills: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      const boardJobs = await this.prisma.job.findMany({
        select: { tags: true },
        orderBy: { createdAt: 'desc' },
        take: 200,
      });

      const frequency = new Map<string, number>();

      for (const job of freelanceJobs) {
        for (const skill of job.skills ?? []) {
          frequency.set(skill, (frequency.get(skill) ?? 0) + 1);
        }
      }

      for (const job of boardJobs) {
        for (const tag of job.tags ?? []) {
          frequency.set(tag, (frequency.get(tag) ?? 0) + 1);
        }
      }

      return [...frequency.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([skill]) => skill);
    } catch (error) {
      this.logger.warn(
        'Failed to query market trending skills',
        error instanceof Error ? error.message : undefined,
      );
      return [];
    }
  }

  private buildFromLlm(
    user: {
      headline: string | null;
      bio: string | null;
      skills: readonly string[];
      githubUrl: string | null;
      linkedinUrl: string | null;
      portfolioUrl: string | null;
      defaultResumeUrl?: string | null;
    },
    llm: LlmInsightsRaw,
    marketSkills: readonly string[],
  ): ProfileInsights {
    const bioText = user.bio ?? '';
    const userSkills = user.skills ?? [];
    const hasLinks = !!(
      user.githubUrl ||
      user.linkedinUrl ||
      user.portfolioUrl ||
      user.defaultResumeUrl
    );

    const hasHeadline = !!user.headline;
    const hasBio = bioText.length > 0;
    const hasSkills = userSkills.length >= 3;
    const profileCompleteness =
      [hasHeadline, hasBio, hasSkills, hasLinks].filter(Boolean).length * 25;

    const hasPiiWarning = PII_EMAIL.test(bioText) || PII_PHONE.test(bioText);

    const containsRelevantKeywords =
      llm.containsRelevantKeywords ??
      RELEVANCE_KEYWORDS.some(
        (kw) =>
          bioText.toLowerCase().includes(kw) ||
          userSkills.some((s) => s.toLowerCase().includes(kw)),
      );

    const trendingFromLlm = llm.trendingSkillsInMarket?.length
      ? llm.trendingSkillsInMarket
      : marketSkills;

    const trendingSkillsInMarket = trendingFromLlm
      .filter((ts) => !userSkills.some((s) => s.toLowerCase() === ts.toLowerCase()))
      .slice(0, 5);

    const suggestedImprovements = this.mergeSuggestions(llm.suggestedImprovements, user);

    return {
      optimizationScore: Math.max(0, Math.min(100, Math.round(llm.optimizationScore ?? 50))),
      profileCompleteness,
      bioAnalysis: {
        length: bioText.length,
        hasPiiWarning,
        containsRelevantKeywords,
      },
      trendingSkillsInMarket,
      suggestedImprovements,
    };
  }

  private buildFromRules(
    user: {
      headline: string | null;
      bio: string | null;
      skills: readonly string[];
      githubUrl: string | null;
      linkedinUrl: string | null;
      portfolioUrl: string | null;
      defaultResumeUrl?: string | null;
    },
    marketSkills: readonly string[],
  ): ProfileInsights {
    const bioText = user.bio ?? '';
    const userSkills = user.skills ?? [];
    const hasLinks = !!(
      user.githubUrl ||
      user.linkedinUrl ||
      user.portfolioUrl ||
      user.defaultResumeUrl
    );

    const hasHeadline = !!user.headline;
    const hasBio = bioText.length > 0;
    const hasSkills = userSkills.length >= 3;

    const profileCompleteness =
      [hasHeadline, hasBio, hasSkills, hasLinks].filter(Boolean).length * 25;
    const filledFields = [hasHeadline, hasBio, hasSkills].filter(Boolean).length;
    const containsRelevantKeywords = RELEVANCE_KEYWORDS.some(
      (kw) =>
        bioText.toLowerCase().includes(kw) || userSkills.some((s) => s.toLowerCase().includes(kw)),
    );
    const optimizationScore = Math.min(
      100,
      Math.round(
        (filledFields / 3) * 60 + (containsRelevantKeywords ? 20 : 0) + (hasLinks ? 20 : 0),
      ),
    );
    const hasPiiWarning = PII_EMAIL.test(bioText) || PII_PHONE.test(bioText);

    const trendingSkillsInMarket =
      marketSkills.length > 0
        ? marketSkills
            .filter((ts) => !userSkills.some((s) => s.toLowerCase() === ts.toLowerCase()))
            .slice(0, 5)
        : [];

    const suggestedImprovements: string[] = [];
    if (bioText.length < 400) {
      suggestedImprovements.push(
        'Expand your bio to at least 400 characters for better AI analysis.',
      );
    }
    if (!hasLinks) {
      suggestedImprovements.push('Add a portfolio link or GitHub URL to showcase your best work.');
    }
    if (userSkills.length < 5) {
      suggestedImprovements.push(
        'Add more skills to your profile — profiles with 5+ skills get better match results.',
      );
    }
    if (!user.headline) {
      suggestedImprovements.push(
        'Add a professional headline so employers immediately understand your expertise.',
      );
    }
    if (hasPiiWarning) {
      suggestedImprovements.push(
        'Remove personal contact information (email/phone) from your bio — it will be redacted before sharing with employers.',
      );
    }
    if (suggestedImprovements.length === 0) {
      suggestedImprovements.push(
        'Your profile is well-optimized for AI matching! Keep your skills and bio up to date.',
      );
    }

    return {
      optimizationScore,
      profileCompleteness,
      bioAnalysis: {
        length: bioText.length,
        hasPiiWarning,
        containsRelevantKeywords,
      },
      trendingSkillsInMarket,
      suggestedImprovements,
    };
  }

  private mergeSuggestions(
    llmSuggestions: string[] | undefined,
    user: {
      headline: string | null;
      bio: string | null;
      skills: readonly string[];
      githubUrl: string | null;
      linkedinUrl: string | null;
      portfolioUrl: string | null;
    },
  ): string[] {
    const merged: string[] = [];

    if (llmSuggestions && llmSuggestions.length > 0) {
      merged.push(...llmSuggestions.slice(0, 4));
    }

    const bioText = user.bio ?? '';
    const hasPiiWarning = PII_EMAIL.test(bioText) || PII_PHONE.test(bioText);
    if (hasPiiWarning) {
      merged.push(
        'Remove personal contact information (email/phone) from your bio — it will be redacted before sharing with employers.',
      );
    }

    if (merged.length === 0) {
      merged.push(
        'Your profile is well-optimized for AI matching! Keep your skills and bio up to date.',
      );
    }

    return merged;
  }
}
