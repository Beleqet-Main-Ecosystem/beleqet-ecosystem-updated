import { Injectable, Inject } from '@nestjs/common';
import { LLM_PROVIDER } from './llm-provider.token';
import type { LlmProvider } from './llm-provider.token';
import { PromptService } from './prompt.service';
import type { JobSummary } from '../interfaces/job.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import type {
  EvaluationBatchResult,
  EvaluationResult,
  EvaluationFailure,
} from '../interfaces/evaluation.interface';

/**
 * Orchestrates LLM-based evaluation for a batch of candidates.
 *
 * For each candidate:
 * 1. Builds an evaluation prompt via PromptService.
 * 2. Sends it to the LLM provider.
 * 3. Maps the structured response to EvaluationResult.
 * 4. Captures any failures as EvaluationFailure (never throws).
 */
@Injectable()
export class LlmEvaluationService {
  constructor(
    private readonly promptService: PromptService,
    @Inject(LLM_PROVIDER) private readonly llmProvider: LlmProvider,
  ) {}

  /**
   * Evaluate a batch of candidates against a single job posting.
   *
   * Processes candidates sequentially and collects both successful
   * results and failures. A candidate failure does not abort the batch.
   *
   * @param job        - Job summary to evaluate against.
   * @param candidates - Sanitized candidate profiles (PII-free).
   * @param locale     - Locale code for prompt selection.
   * @returns EvaluationBatchResult with results, failures, and total latency.
   */
  async evaluateCandidates(
    job: JobSummary,
    candidates: readonly LlmCandidateProfile[],
    locale: string,
  ): Promise<EvaluationBatchResult> {
    const totalStart = Date.now();
    const results: EvaluationResult[] = [];
    const failures: EvaluationFailure[] = [];
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    let totalTokens = 0;

    for (const candidate of candidates) {
      try {
        const prompt = this.promptService.buildEvaluationPrompt(job, candidate, locale);
        const llmResponse = await this.llmProvider.evaluate(prompt);

        totalPromptTokens += llmResponse.tokenUsage.prompt;
        totalCompletionTokens += llmResponse.tokenUsage.completion;
        totalTokens += llmResponse.tokenUsage.total;

        results.push({
          candidateToken: candidate.sessionToken,
          decision: llmResponse.decision,
          confidence: llmResponse.confidence,
          reasoning: llmResponse.reasoning,
          skillGaps: llmResponse.skillGaps,
          strengths: llmResponse.strengths,
          evaluatedAt: new Date(),
        });
      } catch (error) {
        failures.push({
          candidateToken: candidate.sessionToken,
          error: error instanceof Error ? error.message : 'Unknown evaluation error',
        });
      }
    }

    return {
      results,
      failures,
      totalLatencyMs: Date.now() - totalStart,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
    };
  }
}
