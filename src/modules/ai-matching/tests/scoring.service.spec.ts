import type {
  VectorScore,
  LlmScore,
  ScoreWeights,
  ScoredCandidate,
} from '../interfaces/score.interface';
import type { ScoringConfig } from '../config/scoring.config';
import { ScoringService } from '../services/scoring.service';

describe('ScoringService', () => {
  let service: ScoringService;

  const defaultWeights: ScoreWeights = { vector: 0.4, llm: 0.6 };
  const mockConfig: ScoringConfig = {
    weights: defaultWeights,
    minimumMatchScore: 0.5,
  };

  beforeEach(() => {
    service = new ScoringService(mockConfig);
  });

  describe('computeCombinedScore', () => {
    it('should calculate 0.86 when vector is 0.8 and LLM is 0.9 with default weights', () => {
      const vectorScore: VectorScore = { score: 0.8 };
      const llmScore: LlmScore = { confidence: 0.9, calibratedConfidence: 0.9 };

      const result = service.computeCombinedScore(vectorScore, llmScore, defaultWeights);

      expect(result.vectorScore).toBe(0.8);
      expect(result.llmScore).toBe(0.9);
      expect(result.combinedScore).toBeCloseTo(0.86, 5);
    });

    it('should fallback to 100% vector score when llmScore is null', () => {
      const vectorScore: VectorScore = { score: 0.75 };

      const result = service.computeCombinedScore(vectorScore, null, defaultWeights);

      expect(result.vectorScore).toBe(0.75);
      expect(result.llmScore).toBeNull();
      expect(result.combinedScore).toBe(0.75);
    });

    it('should keep combinedScore ≤ 1 with maximal normalized inputs', () => {
      const vectorScore: VectorScore = { score: 100 };
      const llmScore: LlmScore = { confidence: 100, calibratedConfidence: 100 };

      const result = service.computeCombinedScore(vectorScore, llmScore, defaultWeights);

      expect(result.combinedScore).toBe(1);
      expect(result.vectorScore).toBe(1);
      expect(result.llmScore).toBe(1);
    });

    it('should clamp scores below 0 up to 0', () => {
      const vectorScore: VectorScore = { score: -0.5 };
      const llmScore: LlmScore = { confidence: -0.3, calibratedConfidence: -0.3 };

      const result = service.computeCombinedScore(vectorScore, llmScore, defaultWeights);

      expect(result.combinedScore).toBe(0);
      expect(result.vectorScore).toBe(0);
      expect(result.llmScore).toBe(0);
    });

    it('should coerce NaN inputs to 0', () => {
      const vectorScore: VectorScore = { score: NaN };
      const llmScore: LlmScore = { confidence: NaN, calibratedConfidence: NaN };

      const result = service.computeCombinedScore(vectorScore, llmScore, defaultWeights);

      expect(result.vectorScore).toBe(0);
      expect(result.llmScore).toBe(0);
      expect(result.combinedScore).toBe(0);
    });

    it('should coerce Infinity inputs to 0', () => {
      const vectorScore: VectorScore = { score: Infinity };
      const llmScore: LlmScore = { confidence: Infinity, calibratedConfidence: Infinity };

      const result = service.computeCombinedScore(vectorScore, llmScore, { vector: 0.5, llm: 0.5 });

      expect(result.vectorScore).toBe(0);
      expect(result.llmScore).toBe(0);
      expect(result.combinedScore).toBe(0);
    });

    it('should treat scores > 1 as percentages in each component', () => {
      const vectorScore: VectorScore = { score: 85 };
      const llmScore: LlmScore = { confidence: 90, calibratedConfidence: 90 };

      const result = service.computeCombinedScore(vectorScore, llmScore, { vector: 0.5, llm: 0.5 });

      expect(result.vectorScore).toBeCloseTo(0.85, 5);
      expect(result.llmScore).toBeCloseTo(0.9, 5);
    });
  });

  describe('scoreAll', () => {
    it('should assign compositeScore to all candidates', async () => {
      const candidates: ScoredCandidate[] = [
        {
          freelancerId: 'fl_1',
          vectorScore: { score: 0.8 },
          llmScore: { confidence: 0.9, calibratedConfidence: 0.9 },
          compositeScore: { vectorScore: 0, llmScore: null, combinedScore: 0 },
          decision: 'STRONG_MATCH',
          matchedSkills: ['React', 'Node'],
        },
        {
          freelancerId: 'fl_2',
          vectorScore: { score: 0.5 },
          llmScore: null,
          compositeScore: { vectorScore: 0, llmScore: null, combinedScore: 0 },
          decision: null,
          matchedSkills: [],
        },
      ];

      const result = await service.scoreAll(candidates, defaultWeights);

      expect(result).toHaveLength(2);
      expect(result[0].compositeScore.combinedScore).toBeCloseTo(0.86, 5);
      expect(result[1].compositeScore.combinedScore).toBe(0.5);
      expect(result[1].compositeScore.llmScore).toBeNull();
    });

    it('should use default config weights when none are provided', async () => {
      const candidates: ScoredCandidate[] = [
        {
          freelancerId: 'fl_1',
          vectorScore: { score: 0.8 },
          llmScore: { confidence: 0.9, calibratedConfidence: 0.9 },
          compositeScore: { vectorScore: 0, llmScore: null, combinedScore: 0 },
          decision: 'STRONG_MATCH',
          matchedSkills: ['React'],
        },
      ];

      const result = await service.scoreAll(candidates);

      expect(result[0].compositeScore.combinedScore).toBeCloseTo(0.86, 5);
    });

    it('should return an empty array when given no candidates', async () => {
      const result = await service.scoreAll([]);

      expect(result).toEqual([]);
    });
  });
});
