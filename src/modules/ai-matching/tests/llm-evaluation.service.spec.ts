import type { LlmProvider } from '../services/llm-provider.token';
import type { JobSummary } from '../interfaces/job.interface';
import type { LlmCandidateProfile } from '../interfaces/llm-candidate-profile.interface';
import type { LlmResponse } from '../interfaces/llm-response.interface';
import type { PromptTemplate } from '../prompts/prompt-template.interface';
import { LlmEvaluationService } from '../services/llm-evaluation.service';
import { PromptService } from '../services/prompt.service';
import { LLM_PROVIDER } from '../services/llm-provider.token';

describe('LlmEvaluationService', () => {
  let service: LlmEvaluationService;
  let promptService: PromptService;
  let mockLlmProvider: jest.Mocked<LlmProvider>;

  const mockJob: JobSummary = {
    title: 'Senior Developer',
    description: 'Build great software.',
    requiredSkills: ['React', 'Node.js'],
    preferredSkills: ['TypeScript'],
    locale: 'en',
  };

  const makeCandidate = (token: string): LlmCandidateProfile => ({
    sessionToken: token,
    title: 'Developer',
    bioSummary: 'Experienced developer.',
    skills: ['React'],
    experienceYears: 5,
    pastProjectsSummary: ['Project X'],
  });

  const makeLlmResponse = (overrides?: Partial<LlmResponse>): LlmResponse => ({
    decision: 'STRONG_MATCH',
    confidence: 0.85,
    reasoning: 'Great fit.',
    skillGaps: [],
    strengths: ['React'],
    rawOutput: '{"decision":"STRONG_MATCH"}',
    tokenUsage: { prompt: 100, completion: 50, total: 150 },
    latencyMs: 200,
    ...overrides,
  });

  beforeEach(() => {
    promptService = new PromptService();
    mockLlmProvider = {
      evaluate: jest.fn(),
      generate: jest.fn(),
    };
    service = new LlmEvaluationService(promptService, mockLlmProvider);
  });

  describe('evaluateCandidates', () => {
    it('should evaluate each candidate and return results', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());

      const candidates = [makeCandidate('tok_1'), makeCandidate('tok_2')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results).toHaveLength(2);
      expect(result.failures).toHaveLength(0);
      expect(mockLlmProvider.evaluate).toHaveBeenCalledTimes(2);
    });

    it('should populate candidateToken from sessionToken', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());

      const candidates = [makeCandidate('tok_abc')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results[0].candidateToken).toBe('tok_abc');
    });

    it('should propagate LLM decision, confidence, reasoning, skills', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(
        makeLlmResponse({
          decision: 'POTENTIAL_MATCH',
          confidence: 0.7,
          reasoning: 'Good but missing some skills.',
          skillGaps: ['Docker'],
          strengths: ['React', 'Node.js'],
        }),
      );

      const candidates = [makeCandidate('tok_1')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results[0].decision).toBe('POTENTIAL_MATCH');
      expect(result.results[0].confidence).toBe(0.7);
      expect(result.results[0].reasoning).toBe('Good but missing some skills.');
      expect(result.results[0].skillGaps).toEqual(['Docker']);
      expect(result.results[0].strengths).toEqual(['React', 'Node.js']);
    });

    it('should set evaluatedAt as a Date', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());

      const candidates = [makeCandidate('tok_1')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results[0].evaluatedAt).toBeInstanceOf(Date);
    });

    it('should capture failures without aborting the batch', async () => {
      mockLlmProvider.evaluate
        .mockResolvedValueOnce(makeLlmResponse())
        .mockRejectedValueOnce(new Error('LLM timeout'));

      const candidates = [makeCandidate('tok_1'), makeCandidate('tok_2')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results).toHaveLength(1);
      expect(result.failures).toHaveLength(1);
      expect(result.failures[0].candidateToken).toBe('tok_2');
      expect(result.failures[0].error).toBe('LLM timeout');
    });

    it('should handle all candidates failing', async () => {
      mockLlmProvider.evaluate.mockRejectedValue(new Error('API down'));

      const candidates = [makeCandidate('tok_1'), makeCandidate('tok_2')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.results).toHaveLength(0);
      expect(result.failures).toHaveLength(2);
    });

    it('should return empty results for empty candidate array', async () => {
      const result = await service.evaluateCandidates(mockJob, [], 'en');

      expect(result.results).toEqual([]);
      expect(result.failures).toEqual([]);
      expect(mockLlmProvider.evaluate).not.toHaveBeenCalled();
    });

    it('should include totalLatencyMs in the result', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());

      const candidates = [makeCandidate('tok_1')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.totalLatencyMs).toBeGreaterThanOrEqual(0);
    });

    it('should handle errors with non-Error throws', async () => {
      mockLlmProvider.evaluate.mockRejectedValue('string error');

      const candidates = [makeCandidate('tok_1')];
      const result = await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(result.failures[0].error).toBe('Unknown evaluation error');
    });

    it('should call PromptService.buildEvaluationPrompt for each candidate', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());
      const buildSpy = jest.spyOn(promptService, 'buildEvaluationPrompt');

      const candidates = [makeCandidate('tok_1'), makeCandidate('tok_2')];
      await service.evaluateCandidates(mockJob, candidates, 'en');

      expect(buildSpy).toHaveBeenCalledTimes(2);
      expect(buildSpy).toHaveBeenCalledWith(mockJob, candidates[0], 'en');
      expect(buildSpy).toHaveBeenCalledWith(mockJob, candidates[1], 'en');
    });

    it('should pass the built prompt to the LLM provider', async () => {
      mockLlmProvider.evaluate.mockResolvedValue(makeLlmResponse());

      const candidates = [makeCandidate('tok_1')];
      await service.evaluateCandidates(mockJob, candidates, 'en');

      const calledPrompt = mockLlmProvider.evaluate.mock.calls[0][0];
      expect(calledPrompt).toBeDefined();
      expect(calledPrompt.systemPrompt).toBeDefined();
      expect(calledPrompt.userPrompt).toBeDefined();
    });
  });
});
