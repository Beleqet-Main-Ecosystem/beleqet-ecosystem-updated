import { Test, TestingModule } from '@nestjs/testing';
import { NgramService } from './ngram.service';

describe('NgramService', () => {
  let module: TestingModule;
  let service: NgramService;
 
  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [NgramService],
    }).compile();

    service = module.get<NgramService>(NgramService);
  });
 
  afterEach(async () => {
    await module?.close();
  });

  it('returns zero for very short texts', () => {
    const result = service.compare('hi', 'bye');
    expect(result.score).toBe(0);
  });

  it('detects copied phrases', () => {
    const phrase = 'The quick brown fox jumps over the lazy dog near the riverbank.';
    const textA = `Introduction paragraph. ${phrase} Conclusion paragraph.`;
    const textB = `Different intro. ${phrase} Different ending.`;

    const result = service.compare(textA, textB);
    expect(result.score).toBeGreaterThan(0.4);
    expect(result.matchedPhrases!.length).toBeGreaterThan(0);
  });

  it('returns low score for completely different long texts', () => {
    const textA = 'Alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu.';
    const textB = 'One two three four five six seven eight nine ten eleven twelve.';
    const result = service.compare(textA, textB);
    expect(result.score).toBeLessThan(0.2);
  });
});
