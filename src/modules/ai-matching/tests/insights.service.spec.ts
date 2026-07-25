import type { LlmProvider } from '../services/llm-provider.token';
import { PromptService } from '../services/prompt.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { InsightsService } from '../services/insights.service';

const makeUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'fl_1',
  headline: 'Senior Fullstack Developer',
  bio: 'Experienced React and Node.js developer.',
  skills: ['React', 'Node.js', 'TypeScript'],
  githubUrl: 'https://github.com/user',
  linkedinUrl: null,
  portfolioUrl: null,
  defaultResumeUrl: null,
  ...overrides,
});

describe('InsightsService', () => {
  let mockLlmProvider: jest.Mocked<LlmProvider>;
  let promptService: PromptService;
  let prisma: jest.Mocked<PrismaService>;
  let service: InsightsService;

  beforeEach(() => {
    mockLlmProvider = {
      evaluate: jest.fn(),
      generate: jest.fn(),
    };
    promptService = new PromptService();
    prisma = {
      freelanceJob: { findMany: jest.fn().mockResolvedValue([]) },
      job: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as jest.Mocked<PrismaService>;
    service = new InsightsService(mockLlmProvider, promptService, prisma);
  });

  describe('getInsights', () => {
    it('should use LLM result when generate succeeds', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 78,
          bioQuality: 'good',
          containsRelevantKeywords: true,
          suggestedImprovements: ['Add more backend skills'],
          trendingSkillsInMarket: ['GraphQL', 'Kubernetes'],
        }),
      );

      const result = await service.getInsights(makeUser());

      expect(result.optimizationScore).toBe(78);
      expect(result.trendingSkillsInMarket).toContain('GraphQL');
      expect(mockLlmProvider.generate).toHaveBeenCalled();
    });

    it('should fall back to rule-based when LLM fails', async () => {
      mockLlmProvider.generate.mockRejectedValue(new Error('API down'));

      const result = await service.getInsights(makeUser());

      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
      expect(result.optimizationScore).toBeLessThanOrEqual(100);
      expect(result.suggestedImprovements.length).toBeGreaterThanOrEqual(1);
    });

    it('should fall back to rule-based when LLM returns invalid JSON', async () => {
      mockLlmProvider.generate.mockResolvedValue('not json');

      const result = await service.getInsights(makeUser());

      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
    });

    it('should fall back to rule-based when LLM returns missing optimizationScore', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          bioQuality: 'good',
        }),
      );

      const result = await service.getInsights(makeUser());

      expect(result.optimizationScore).toBeGreaterThanOrEqual(0);
    });

    it('should clamp optimizationScore to 0-100', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 150,
        }),
      );

      const result = await service.getInsights(makeUser());

      expect(result.optimizationScore).toBe(100);
    });

    it('should detect PII via regex regardless of LLM output', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 70,
        }),
      );

      const result = await service.getInsights(
        makeUser({
          bio: 'Email me at test@example.com',
        }),
      );

      expect(result.bioAnalysis.hasPiiWarning).toBe(true);
    });

    it('should include PII warning in merged suggestions when detected', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 70,
          suggestedImprovements: ['Update your headline'],
        }),
      );

      const result = await service.getInsights(
        makeUser({
          bio: 'Call +251911234567',
        }),
      );

      expect(result.suggestedImprovements).toEqual(
        expect.arrayContaining([expect.stringContaining('Remove personal contact information')]),
      );
    });

    it('should compute profileCompleteness from user data', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 80,
        }),
      );

      const result = await service.getInsights(
        makeUser({
          headline: 'Dev',
          bio: 'A bio',
          skills: ['React', 'Node.js', 'TypeScript', 'Python'],
          githubUrl: 'https://github.com/user',
        }),
      );

      expect(result.profileCompleteness).toBe(100);
    });

    it('should filter trending skills already on profile', async () => {
      mockLlmProvider.generate.mockResolvedValue(
        JSON.stringify({
          optimizationScore: 70,
          trendingSkillsInMarket: ['React', 'GraphQL', 'TypeScript', 'Kubernetes'],
        }),
      );

      const result = await service.getInsights(makeUser());

      expect(result.trendingSkillsInMarket).not.toContain('React');
      expect(result.trendingSkillsInMarket).not.toContain('TypeScript');
      expect(result.trendingSkillsInMarket).toContain('GraphQL');
      expect(result.trendingSkillsInMarket).toContain('Kubernetes');
    });
  });
});
