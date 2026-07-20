import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ScoreAggregatorService } from './score-aggregator.service';
import { PlagiarismConfig } from '../utils/plagiarism.config';

describe('ScoreAggregatorService', () => {
  let aggregator: ScoreAggregatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ScoreAggregatorService,
        PlagiarismConfig,
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    aggregator = module.get<ScoreAggregatorService>(ScoreAggregatorService);
  });

  it('aggregates weighted scores correctly', () => {
    const score = aggregator.aggregate(
      { jaccard: 1, cosine: 1, ngram: 1, semantic: 1 },
      { jaccard: 0.2, cosine: 0.25, ngram: 0.2, semantic: 0.35 },
    );
    expect(score).toBe(1);
  });

  it('returns partial score for mixed inputs', () => {
    const score = aggregator.aggregate(
      { jaccard: 0.5, cosine: 0.5, ngram: 0.5, semantic: 0.5 },
      { jaccard: 0.2, cosine: 0.25, ngram: 0.2, semantic: 0.35 },
    );
    expect(score).toBe(0.5);
  });

  it('builds a complete comparison result', () => {
    const result = aggregator.buildResult(
      { jaccard: 0.8, cosine: 0.7, ngram: 0.6, semantic: 0.9 },
      ['typescript', 'nestjs'],
      [{ phrase: 'nestjs', inputOccurrences: 1, sourceOccurrences: 1 }],
    );

    expect(result.similarity).toBeGreaterThan(0);
    expect(result.matchedTokens).toContain('typescript');
    expect(result.algorithmScores.semantic).toBe(0.9);
  });
});
