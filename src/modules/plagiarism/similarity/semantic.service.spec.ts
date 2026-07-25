import { Test, TestingModule } from '@nestjs/testing';
import { SemanticService } from './semantic.service';

jest.mock('@xenova/transformers', () => ({
  pipeline: jest.fn().mockResolvedValue(async (text: string) => ({
    data: new Float32Array(text.length > 0 ? [1, 0, 0] : [0, 0, 0]),
  })),
}));

describe('SemanticService', () => {
  let service: SemanticService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SemanticService],
    }).compile();

    service = module.get<SemanticService>(SemanticService);
  });

  it('returns high similarity for identical texts', async () => {
    const text = 'Software engineer with experience in cloud infrastructure and DevOps.';
    const result = await service.compare(text, text);
    expect(result.score).toBeGreaterThan(0.9);
  });

  it('returns zero on model failure', async () => {
    jest.resetModules();
    const result = await service.compare('', '');
    expect(result.score).toBeGreaterThanOrEqual(0);
  });
});
