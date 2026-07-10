import { Test, TestingModule } from '@nestjs/testing';
import { CosineService } from './cosine.service';
import { TokenizerService } from '../tokenizer/tokenizer.service';

describe('CosineService', () => {
  let service: CosineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CosineService, TokenizerService],
    }).compile();

    service = module.get<CosineService>(CosineService);
  });

  it('returns zero for unrelated texts', () => {
    const result = service.compare(
      'Database administrator managing PostgreSQL clusters.',
      'Creative writer crafting fiction novels and poetry.',
    );
    expect(result.score).toBe(0);
  });

  it('returns high score for identical texts', () => {
    const text = 'Experienced software engineer with TypeScript and NestJS expertise.';
    const result = service.compare(text, text);
    expect(result.score).toBeCloseTo(1, 1);
  });

  it('detects similar wording', () => {
    const textA = 'We need a developer skilled in React and Node.js for our startup.';
    const textB = 'Looking for a developer with React and Node.js skills for startup work.';
    const result = service.compare(textA, textB);
    expect(result.score).toBeGreaterThan(0.3);
  });
});
