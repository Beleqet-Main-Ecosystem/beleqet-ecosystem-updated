import type { Job, JobSummary } from '../interfaces/job.interface';
import type { Candidate } from '../interfaces/candidate.interface';
import type { VectorSearchResult, VectorSearchHit } from '../interfaces/vector-search.interface';
import type { EvaluationBatchResult, EvaluationResult } from '../interfaces/evaluation.interface';
import type { ScoredCandidate } from '../interfaces/score.interface';
import type { RankedCandidate, MatchResult } from '../interfaces/match-result.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import type { EmbeddingResult } from '../interfaces/embedding.interface';
import type { ScoreWeights } from '../interfaces/score.interface';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingQueueService } from '../services/embedding-queue.service';
import { MetricsService } from '../services/metrics.service';
import { MatchingService } from '../services/matching.service';
import { EmbeddingService } from '../services/embedding.service';
import { VectorSearchService } from '../services/vector-search.service';
import { SanitizerService } from '../services/sanitizer.service';
import { LlmEvaluationService } from '../services/llm-evaluation.service';
import { ScoringService } from '../services/scoring.service';
import { RankingService } from '../services/ranking.service';

describe('MatchingService', () => {
  let service: MatchingService;
  let prisma: jest.Mocked<PrismaService>;
  let embeddingQueueService: jest.Mocked<EmbeddingQueueService>;
  let metricsService: jest.Mocked<MetricsService>;
  let embeddingService: jest.Mocked<EmbeddingService>;
  let vectorSearchService: jest.Mocked<VectorSearchService>;
  let sanitizerService: jest.Mocked<SanitizerService>;
  let llmEvaluationService: jest.Mocked<LlmEvaluationService>;
  let scoringService: jest.Mocked<ScoringService>;
  let rankingService: jest.Mocked<RankingService>;

  const mockJob: Job = {
    id: 'job_1',
    title: 'Senior React Developer',
    description: 'Build amazing UIs.',
    requiredSkills: ['React', 'TypeScript'],
    preferredSkills: ['GraphQL'],
    budget: 8000,
    currency: 'USD',
    locale: 'en',
    employerId: 'emp_1',
    createdAt: new Date('2026-01-01'),
  };

  const mockEmbeddingResult: EmbeddingResult = {
    embedding: { vector: [0.1, 0.2, 0.3], model: 'test', dimensions: 3 },
    sourceText: 'job description',
    tokenCount: 10,
    latencyMs: 50,
  };

  const mockHit: VectorSearchHit = {
    freelancerId: 'fl_1',
    score: 0.85,
    embedding: [0.1, 0.2, 0.3],
    metadata: {
      title: 'Fullstack Developer',
      bio: 'Experienced React developer.',
      skills: ['React', 'Node.js'],
      experienceYears: 5,
      hourlyRate: 50,
    },
  };

  const mockSearchResult: VectorSearchResult = {
    hits: [mockHit],
    query: { embedding: [0.1, 0.2, 0.3], topK: 20, minScore: 0 },
    totalCandidates: 1,
    latencyMs: 30,
  };

  const mockSanitizedProfile: LlmCandidateProfile = {
    sessionToken: 'candidate_token',
    title: 'Fullstack Developer',
    bioSummary: 'Experienced React developer.',
    skills: ['React', 'Node.js'],
    experienceYears: 5,
    pastProjectsSummary: [],
  };

  const mockEvalResult: EvaluationResult = {
    candidateToken: 'candidate_token',
    decision: 'STRONG_MATCH',
    confidence: 0.92,
    reasoning: 'Great fit for the role.',
    skillGaps: ['Docker'],
    strengths: ['React', 'TypeScript'],
    evaluatedAt: new Date(),
  };

  const mockEvalBatch: EvaluationBatchResult = {
    results: [mockEvalResult],
    failures: [],
    totalLatencyMs: 200,
    totalPromptTokens: 100,
    totalCompletionTokens: 50,
    totalTokens: 150,
  };

  const mockRanked: RankedCandidate[] = [
    {
      freelancerId: 'fl_1',
      freelancerName: '',
      rank: 1,
      combinedScore: 0.88,
      decision: 'STRONG_MATCH',
      reasoningSnippet: '',
      matchedSkills: ['React'],
      skillGaps: [],
    },
  ];

  beforeEach(() => {
    prisma = {
      $queryRawUnsafe: jest.fn().mockResolvedValue([{ count: 10 }]),
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'fl_1', firstName: 'John', lastName: 'Doe' }]),
      },
    } as unknown as jest.Mocked<PrismaService>;

    embeddingQueueService = {
      scheduleFullReindex: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingQueueService>;

    metricsService = {
      recordPipelineRun: jest.fn(),
    } as unknown as jest.Mocked<MetricsService>;

    embeddingService = {
      embedJob: jest.fn(),
    } as unknown as jest.Mocked<EmbeddingService>;

    vectorSearchService = {
      searchCandidates: jest.fn(),
    } as unknown as jest.Mocked<VectorSearchService>;

    sanitizerService = {
      sanitizeBatch: jest.fn().mockResolvedValue([mockSanitizedProfile]),
      getMapping: jest.fn().mockReturnValue({
        freelancerId: 'fl_1',
        sessionToken: 'candidate_token',
      }),
      getAllMappings: jest.fn().mockReturnValue([]),
      sanitize: jest.fn(),
    } as unknown as jest.Mocked<SanitizerService>;

    llmEvaluationService = {
      evaluateCandidates: jest.fn(),
    } as unknown as jest.Mocked<LlmEvaluationService>;

    scoringService = {
      scoreAll: jest.fn(),
    } as unknown as jest.Mocked<ScoringService>;

    rankingService = {
      rerank: jest.fn(),
    } as unknown as jest.Mocked<RankingService>;

    service = new MatchingService(
      prisma,
      embeddingQueueService,
      embeddingService,
      vectorSearchService,
      sanitizerService,
      llmEvaluationService,
      scoringService,
      rankingService,
      metricsService,
    );
  });

  describe('match', () => {
    it('should run the full pipeline and return a MatchResult', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([
        {
          freelancerId: 'fl_1',
          vectorScore: { score: 0.85 },
          llmScore: { confidence: 0.92, calibratedConfidence: 0.92 },
          compositeScore: { vectorScore: 0.85, llmScore: 0.92, combinedScore: 0.88 },
          decision: 'STRONG_MATCH',
          matchedSkills: ['React', 'Node.js'],
        },
      ]);
      rankingService.rerank.mockResolvedValue(mockRanked);

      const result = await service.match(mockJob);

      expect(result).toBeDefined();
      expect(result.jobId).toBe('job_1');
      expect(result.rankedCandidates).toHaveLength(1);
      expect(result.rankedCandidates[0].freelancerId).toBe('fl_1');
    });

    it('should return enriched candidates with reasoningSnippet and skillGaps', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([
        {
          freelancerId: 'fl_1',
          vectorScore: { score: 0.85 },
          llmScore: { confidence: 0.92, calibratedConfidence: 0.92 },
          compositeScore: { vectorScore: 0.85, llmScore: 0.92, combinedScore: 0.88 },
          decision: 'STRONG_MATCH',
          matchedSkills: ['React', 'Node.js'],
        },
      ]);
      rankingService.rerank.mockResolvedValue(mockRanked);

      const result = await service.match(mockJob);

      const enriched = result.rankedCandidates[0];
      expect(enriched.reasoningSnippet).toBe('Great fit for the role.');
      expect(enriched.skillGaps).toEqual(['Docker']);
    });

    it('should return empty candidates when vector search has no hits', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue({
        ...mockSearchResult,
        hits: [],
      });

      const result = await service.match(mockJob);

      expect(result.rankedCandidates).toEqual([]);
      expect(result.totalCandidatesConsidered).toBe(0);
    });

    it('should skip LLM evaluation when there are no sanitized profiles', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      sanitizerService.sanitizeBatch.mockResolvedValue([]);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      await service.match(mockJob);

      expect(llmEvaluationService.evaluateCandidates).not.toHaveBeenCalled();
    });

    it('should pass options.topK to the ranking service', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      await service.match(mockJob, { topK: 5 });

      expect(rankingService.rerank).toHaveBeenCalledWith(expect.anything(), 5);
    });

    it('should default topK to 20 when not provided', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      await service.match(mockJob);

      expect(rankingService.rerank).toHaveBeenCalledWith(expect.anything(), 20);
    });

    it('should pass the locale through the pipeline', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      const jobWithLocale: Job = { ...mockJob, locale: 'am' };
      await service.match(jobWithLocale);

      expect(llmEvaluationService.evaluateCandidates).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'am' }),
        expect.anything(),
        'am',
      );
    });

    it('should generate a sessionId in the result', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      const result = await service.match(mockJob);

      expect(result.sessionId).toBeDefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('should include completedAt timestamp', async () => {
      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue(mockSearchResult);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);
      const before = Date.now();

      const result = await service.match(mockJob);

      expect(result.completedAt.getTime()).toBeGreaterThanOrEqual(before);
    });
  });

  describe('hitsToCandidates (via search result)', () => {
    it('should map metadata fields from vector hits', async () => {
      const hitWithFullMeta: VectorSearchHit = {
        freelancerId: 'fl_full',
        score: 0.9,
        embedding: [0.1, 0.2, 0.3],
        metadata: {
          title: 'Senior Dev',
          bio: 'Full bio text.',
          skills: ['React', 'Node', 'Python'],
          experienceYears: 8,
          hourlyRate: 75,
          portfolioUrls: ['https://github.com/user'],
          pastProjects: [
            {
              title: 'Project A',
              description: 'Desc A',
              skillsUsed: ['React'],
              durationMonths: 12,
            },
          ],
        },
      };

      embeddingService.embedJob.mockResolvedValue(mockEmbeddingResult);
      vectorSearchService.searchCandidates.mockResolvedValue({
        ...mockSearchResult,
        hits: [hitWithFullMeta],
      });
      sanitizerService.sanitizeBatch.mockResolvedValue([mockSanitizedProfile]);
      llmEvaluationService.evaluateCandidates.mockResolvedValue(mockEvalBatch);
      scoringService.scoreAll.mockResolvedValue([]);
      rankingService.rerank.mockResolvedValue([]);

      await service.match(mockJob);

      expect(sanitizerService.sanitizeBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            freelancerId: 'fl_full',
            skills: ['React', 'Node', 'Python'],
            experienceYears: 8,
          }),
        ]),
      );
    });
  });
});
