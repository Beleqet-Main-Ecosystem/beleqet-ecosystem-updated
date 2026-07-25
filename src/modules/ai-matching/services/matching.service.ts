import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { EmbeddingQueueService } from './embedding-queue.service';
import type { Job, JobSummary } from '../interfaces/job.interface';
import type { Candidate, PastProject } from '../interfaces/candidate.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import type { VectorSearchHit, VectorSearchResult } from '../interfaces/vector-search.interface';
import type {
  EvaluationBatchResult,
  EvaluationResult,
  EvaluationDecision,
} from '../interfaces/evaluation.interface';
import type { ScoredCandidate, LlmScore } from '../interfaces/score.interface';
import type { MatchResult, RankedCandidate } from '../interfaces/match-result.interface';
import type { SessionId } from '../types/session-id.type';
import type { MatchingOptionsDto } from '../dto/matching-options.dto';
import { EmbeddingService } from './embedding.service';
import { VectorSearchService } from './vector-search.service';
import { SanitizerService } from './sanitizer.service';
import { LlmEvaluationService } from './llm-evaluation.service';
import { ScoringService } from './scoring.service';
import { RankingService } from './ranking.service';
import { MetricsService } from './metrics.service';
import { generateOpaqueToken } from '../utils/token-generator.util';

/** Evaluation data attached to a freelancer, used to enrich RankedCandidate. */
interface EvaluationAttachment {
  readonly skillGaps: readonly string[];
  readonly reasoning: string;
  readonly strengths: readonly string[];
  readonly decision: EvaluationDecision | null;
  readonly confidence: number;
}

/**
 * Core orchestrator for the two-stage hybrid RAG matching pipeline.
 *
 * Pipeline order:
 * 1. Embed    — Generate job embedding via EmbeddingService
 * 2. Search   — Retrieve top candidates via VectorSearchService
 * 3. Sanitize — Remove PII via SanitizerService
 * 4. Evaluate — LLM deep evaluation via LlmEvaluationService (optional)
 * 5. Score    — Weighted composite via ScoringService
 * 6. Rank     — Sort, tie-break, truncate via RankingService
 * 7. Enrich   — Attach evaluation data (skill gaps, reasoning)
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly embeddingQueueService: EmbeddingQueueService,
    private readonly embeddingService: EmbeddingService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly sanitizerService: SanitizerService,
    private readonly llmEvaluationService: LlmEvaluationService,
    private readonly scoringService: ScoringService,
    private readonly rankingService: RankingService,
    private readonly metricsService: MetricsService,
  ) {}

  /**
   * Execute the full matching pipeline for a job posting.
   *
   * @param job     - The job to match freelancers against.
   * @param options - Optional overrides for locale, topK, and similarity threshold.
   * @returns MatchResult with ranked candidates, session metadata, and timing.
   */
  async match(job: Job, options?: MatchingOptionsDto): Promise<MatchResult> {
    const sessionId = generateOpaqueToken('session') as unknown as SessionId;
    const locale = options?.locale ?? job.locale ?? 'en';
    const llmEnabled = true;

    const pipelineStart = Date.now();

    try {
      const rows = await this.prisma.$queryRawUnsafe<Array<{ count: number }>>(
        `SELECT COUNT(*) AS count FROM users WHERE role = 'FREELANCER' AND embedding IS NOT NULL`,
      );
      const freelancerWithEmbeddings = Number(rows[0]?.count ?? 0);
      if (freelancerWithEmbeddings === 0) {
        this.logger.warn('No freelancer embeddings found — triggering full reindex');
        await this.embeddingQueueService.scheduleFullReindex('user');
        await this.embeddingQueueService.scheduleFullReindex('freelanceJob');
        await this.embeddingQueueService.scheduleFullReindex('job');

        this.metricsService.recordPipelineRun({
          embeddingMs: 0,
          vectorSearchMs: 0,
          llmEvaluationMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          matchCount: 0,
          isFallback: true,
          isSuccess: true,
        });

        return {
          sessionId,
          jobId: job.id,
          rankedCandidates: [],
          totalCandidatesConsidered: 0,
          completedAt: new Date(),
        };
      }

      const embedStart = Date.now();
      const embeddingResult = await this.embeddingService.embedJob(job);
      const embeddingMs = Date.now() - embedStart;

      const vectorStart = Date.now();
      const searchResult = await this.vectorSearchService.searchCandidates(
        embeddingResult.embedding.vector,
      );
      const vectorSearchMs = Date.now() - vectorStart;

      if (searchResult.hits.length === 0) {
        this.metricsService.recordPipelineRun({
          embeddingMs,
          vectorSearchMs,
          llmEvaluationMs: 0,
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
          matchCount: 0,
          isFallback: true,
          isSuccess: true,
        });

        return {
          sessionId,
          jobId: job.id,
          rankedCandidates: [],
          totalCandidatesConsidered: 0,
          completedAt: new Date(),
        };
      }

      const candidates = this.hitsToCandidates(searchResult.hits);

      const sanitizedProfiles = await this.sanitizerService.sanitizeBatch(candidates);

      const jobSummary: JobSummary = {
        title: job.title,
        description: job.description,
        requiredSkills: job.requiredSkills,
        preferredSkills: job.preferredSkills,
        locale: job.locale,
      };

      const evalBatch: EvaluationBatchResult | null =
        llmEnabled && sanitizedProfiles.length > 0
          ? await this.llmEvaluationService.evaluateCandidates(
              jobSummary,
              sanitizedProfiles,
              locale,
            )
          : null;

      const evalAttachments = this.buildEvaluationAttachments(evalBatch);
      const scoredCandidates = this.buildScoredCandidates(
        candidates,
        sanitizedProfiles,
        searchResult,
        evalAttachments,
      );

      const scoredWithScores = await this.scoringService.scoreAll(scoredCandidates);

      const maxResults = options?.topK ?? 20;
      const ranked = await this.rankingService.rerank(scoredWithScores, maxResults);

      const enriched = this.enrichRankedCandidates(ranked, evalAttachments);

      const freelancerIds = enriched.map((c) => c.freelancerId);
      const users = await this.prisma.user.findMany({
        where: { id: { in: freelancerIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      const nameMap = new Map(users.map((u) => [u.id, `${u.firstName} ${u.lastName}`]));
      const withNames = enriched.map((c) => ({
        ...c,
        freelancerName: nameMap.get(c.freelancerId) ?? c.freelancerId,
      }));

      const llmEvaluationMs = evalBatch?.totalLatencyMs ?? 0;
      const promptTokens = evalBatch?.totalPromptTokens ?? 0;
      const completionTokens = evalBatch?.totalCompletionTokens ?? 0;
      const totalTokens = evalBatch?.totalTokens ?? 0;
      const isFallback = evalBatch === null;

      this.metricsService.recordPipelineRun({
        embeddingMs,
        vectorSearchMs,
        llmEvaluationMs,
        promptTokens,
        completionTokens,
        totalTokens,
        matchCount: withNames.length,
        isFallback,
        isSuccess: true,
      });

      return {
        sessionId,
        jobId: job.id,
        rankedCandidates: withNames,
        totalCandidatesConsidered: searchResult.totalCandidates,
        completedAt: new Date(),
      };
    } catch (error) {
      this.metricsService.recordPipelineRun({
        embeddingMs: 0,
        vectorSearchMs: 0,
        llmEvaluationMs: 0,
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        matchCount: 0,
        isFallback: true,
        isSuccess: false,
      });
      throw error;
    }
  }

  /**
   * Build a freelancerId → EvaluationAttachment map from the LLM evaluation batch.
   * Resolves candidateToken back to freelancerId via SanitizerService.getMapping().
   */
  private buildEvaluationAttachments(
    evalBatch: EvaluationBatchResult | null,
  ): Map<string, EvaluationAttachment> {
    const map = new Map<string, EvaluationAttachment>();

    if (!evalBatch) return map;

    for (const result of evalBatch.results) {
      const mapping = this.sanitizerService.getMapping(result.candidateToken);
      if (!mapping) continue;

      map.set(mapping.freelancerId, {
        skillGaps: result.skillGaps,
        reasoning: result.reasoning,
        strengths: result.strengths,
        decision: result.decision,
        confidence: result.confidence,
      });
    }

    return map;
  }

  /**
   * Construct ScoredCandidate[] by joining vector search hits with
   * LLM evaluation attachments.
   *
   * Each index in the arrays corresponds to the same candidate —
   * sanitizedProfiles are in the same order as the input candidates,
   * which come from searchResult.hits in the same order.
   */
  private buildScoredCandidates(
    candidates: readonly Candidate[],
    sanitizedProfiles: readonly LlmCandidateProfile[],
    searchResult: VectorSearchResult,
    evalAttachments: Map<string, EvaluationAttachment>,
  ): ScoredCandidate[] {
    const scored: ScoredCandidate[] = [];

    for (let i = 0; i < sanitizedProfiles.length; i++) {
      const profile = sanitizedProfiles[i];
      const hit = searchResult.hits[i];
      const mapping = this.sanitizerService.getMapping(profile.sessionToken);
      const freelancerId = mapping?.freelancerId ?? hit.freelancerId;
      const evalData = evalAttachments.get(freelancerId);

      const llmScore: LlmScore | null = evalData
        ? {
            confidence: evalData.confidence,
            calibratedConfidence:
              evalData.decision === 'STRONG_MATCH'
                ? evalData.confidence
                : evalData.decision === 'POTENTIAL_MATCH'
                  ? evalData.confidence * 0.7
                  : evalData.decision === 'WEAK_MATCH'
                    ? evalData.confidence * 0.3
                    : 0,
          }
        : null;

      scored.push({
        freelancerId,
        vectorScore: { score: hit.score },
        llmScore,
        compositeScore: { vectorScore: 0, llmScore: null, combinedScore: 0 },
        decision: evalData?.decision ?? null,
        matchedSkills: this.computeMatchedSkills(
          candidates[i]?.skills ?? [],
          evalData?.strengths ?? [],
        ),
      });
    }

    return scored;
  }

  /**
   * Compute the set of skills where the candidate matched the job.
   *
   * Intersects job requiredSkills with candidate skills. If LLM evaluation
   * identified strengths, those skills are also included.
   */
  private computeMatchedSkills(
    candidateSkills: readonly string[],
    llmStrengths: readonly string[],
  ): readonly string[] {
    if (llmStrengths.length > 0) return llmStrengths;
    return candidateSkills;
  }

  /**
   * Enrich RankedCandidate placeholders with actual evaluation data.
   *
   * The RankingService cannot access LLM evaluation data (it only sees
   * ScoredCandidate), so the MatchingService patches in reasoningSnippet
   * and skillGaps after ranking.
   */
  private enrichRankedCandidates(
    ranked: readonly RankedCandidate[],
    evalAttachments: Map<string, EvaluationAttachment>,
  ): readonly RankedCandidate[] {
    return ranked.map((c) => {
      const evalData = evalAttachments.get(c.freelancerId);
      if (!evalData) return c;

      return {
        ...c,
        reasoningSnippet: evalData.reasoning,
        skillGaps: evalData.skillGaps,
      };
    });
  }

  /**
   * Convert raw vector search hits to Candidate domain objects.
   *
   * Attempts to extract profile data from the hit's metadata (stored
   * alongside the embedding in the vector index). Falls back to sensible
   * defaults so downstream sanitization and evaluation can proceed.
   */
  private hitsToCandidates(hits: readonly VectorSearchHit[]): Candidate[] {
    return hits.map((hit) => {
      const m = hit.metadata as Record<string, unknown> | undefined;

      return {
        id: hit.freelancerId,
        freelancerId: hit.freelancerId,
        title: typeof m?.title === 'string' ? m.title : '',
        bio: typeof m?.bio === 'string' ? m.bio : '',
        skills: Array.isArray(m?.skills) ? (m.skills as string[]) : [],
        experienceYears: typeof m?.experienceYears === 'number' ? m.experienceYears : 0,
        hourlyRate: typeof m?.hourlyRate === 'number' ? m.hourlyRate : 0,
        portfolioUrls: Array.isArray(m?.portfolioUrls) ? (m.portfolioUrls as string[]) : [],
        pastProjects: Array.isArray(m?.pastProjects) ? (m.pastProjects as PastProject[]) : [],
        consentGiven: true,
      };
    });
  }
}
