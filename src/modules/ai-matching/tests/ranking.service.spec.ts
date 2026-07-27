import type { ScoringConfig } from '../config/scoring.config';
import type { ScoredCandidate } from '../interfaces/score.interface';
import { RankingService } from '../services/ranking.service';

describe('RankingService', () => {
  let service: RankingService;

  const mockConfig: ScoringConfig = {
    weights: { vector: 0.4, llm: 0.6 },
    minimumMatchScore: 0.5,
  };

  const makeCandidate = (
    freelancerId: string,
    combinedScore: number,
    vectorScore: number = 0,
  ): ScoredCandidate => ({
    freelancerId,
    vectorScore: { score: vectorScore },
    llmScore: null,
    compositeScore: { vectorScore, llmScore: null, combinedScore },
    decision: null,
    matchedSkills: [],
  });

  beforeEach(() => {
    service = new RankingService(mockConfig);
  });

  describe('rerank', () => {
    it('should sort candidates by combinedScore descending', async () => {
      const candidates = [
        makeCandidate('fl_1', 0.6),
        makeCandidate('fl_2', 0.9),
        makeCandidate('fl_3', 0.7),
      ];

      const result = await service.rerank(candidates, 10);

      expect(result[0].freelancerId).toBe('fl_2');
      expect(result[1].freelancerId).toBe('fl_3');
      expect(result[2].freelancerId).toBe('fl_1');
    });

    it('should use vectorScore as tiebreaker when combinedScore is equal', async () => {
      const candidates = [makeCandidate('fl_1', 0.7, 0.5), makeCandidate('fl_2', 0.7, 0.8)];

      const result = await service.rerank(candidates, 10);

      expect(result[0].freelancerId).toBe('fl_2');
      expect(result[1].freelancerId).toBe('fl_1');
    });

    it('should filter out candidates below minimumMatchScore', async () => {
      const candidates = [
        makeCandidate('fl_1', 0.9),
        makeCandidate('fl_2', 0.4),
        makeCandidate('fl_3', 0.6),
      ];

      const result = await service.rerank(candidates, 10);

      expect(result).toHaveLength(2);
      expect(result[0].freelancerId).toBe('fl_1');
      expect(result[1].freelancerId).toBe('fl_3');
    });

    it('should truncate to maxResults', async () => {
      const candidates = [
        makeCandidate('fl_1', 0.9),
        makeCandidate('fl_2', 0.8),
        makeCandidate('fl_3', 0.7),
      ];

      const result = await service.rerank(candidates, 2);

      expect(result).toHaveLength(2);
    });

    it('should assign 1-based ranks', async () => {
      const candidates = [
        makeCandidate('fl_1', 0.9),
        makeCandidate('fl_2', 0.7),
        makeCandidate('fl_3', 0.5),
      ];

      const result = await service.rerank(candidates, 10);

      expect(result[0].rank).toBe(1);
      expect(result[1].rank).toBe(2);
      expect(result[2].rank).toBe(3);
    });

    it('should return an empty array when no candidates are given', async () => {
      const result = await service.rerank([], 10);

      expect(result).toEqual([]);
    });

    it('should return an empty array when all candidates are below threshold', async () => {
      const candidates = [makeCandidate('fl_1', 0.3), makeCandidate('fl_2', 0.4)];

      const result = await service.rerank(candidates, 10);

      expect(result).toEqual([]);
    });

    it('should set decision to PENDING when no LLM decision exists', async () => {
      const candidates = [makeCandidate('fl_1', 0.9)];

      const result = await service.rerank(candidates, 10);

      expect(result[0].decision).toBe('PENDING');
    });

    it('should keep existing decision when present', async () => {
      const candidate: ScoredCandidate = {
        ...makeCandidate('fl_1', 0.9),
        decision: 'STRONG_MATCH',
      };

      const result = await service.rerank([candidate], 10);

      expect(result[0].decision).toBe('STRONG_MATCH');
    });

    it('should populate freelancerId, combinedScore, matchedSkills on output', async () => {
      const candidates = [{ ...makeCandidate('fl_1', 0.85), matchedSkills: ['React', 'Node'] }];

      const result = await service.rerank(candidates, 10);

      expect(result[0].freelancerId).toBe('fl_1');
      expect(result[0].combinedScore).toBe(0.85);
      expect(result[0].matchedSkills).toEqual(['React', 'Node']);
      expect(result[0].reasoningSnippet).toBe('');
      expect(result[0].skillGaps).toEqual([]);
    });

    it('should not mutate the input array', async () => {
      const candidates = [makeCandidate('fl_1', 0.3), makeCandidate('fl_2', 0.9)];
      const original = [...candidates];

      await service.rerank(candidates, 10);

      expect(candidates).toEqual(original);
    });
  });
});
