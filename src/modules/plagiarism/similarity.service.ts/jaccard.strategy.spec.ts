import { Test, TestingModule } from '@nestjs/testing';
import { JaccardStrategy } from './jaccard.strategy';
import { TokenizerService } from '../tokenizer/tokenizer.service';

describe('JaccardStrategy', () => {
  let strategy: JaccardStrategy;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [JaccardStrategy, TokenizerService],
    }).compile();

    strategy = module.get<JaccardStrategy>(JaccardStrategy);
  });

  it('returns zero similarity for unrelated texts', () => {
    const result = strategy.compare(
      'Senior backend engineer with NestJS and PostgreSQL experience building APIs.',
      'Graphic designer specializing in brand identity and illustration for startups.',
    );

    expect(result.score).toBe(0);
    expect(result.matchedTokens).toHaveLength(0);
  });

  it('detects high similarity for nearly identical texts', () => {
    const text =
      'My name is Mikiyas Getnet i am a full stack developer experienced in React, Node.js, and PostgreSQL databases.';

    const result = strategy.compare(text, text);

    expect(result.score).toBe(1);
    expect(result.matchedTokens.length).toBeGreaterThan(0);
  });

  it('detects partial overlap between similar job descriptions', () => {
    const textA =
      'Seeking a remote software engineer with strong TypeScript skills and experience in NestJS backend development.';
    const textB =
      'Looking for a remote developer with TypeScript expertise and NestJS backend experience for our team.';

    const result = strategy.compare(textA, textB);

    expect(result.score).toBeGreaterThan(0.3);
    expect(result.matchedTokens).toContain('typescript');
    expect(result.matchedTokens).toContain('nestjs');
  });
});
// Verdict rules:

// < 0.35 → original
// 0.35–0.59 → suspicious
// ≥ 0.60 → likely_plagiarized