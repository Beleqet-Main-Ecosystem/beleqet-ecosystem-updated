import { Test, TestingModule } from '@nestjs/testing';
import { QueryClassifierService } from './services/query-classifier.service';

describe('QueryClassifierService', () => {
  let service: QueryClassifierService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QueryClassifierService],
    }).compile();

    service = module.get<QueryClassifierService>(QueryClassifierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should classify wallet withdrawal queries with high confidence', () => {
    const result = service.classify('How do I withdraw from my wallet using Telebirr?');
    expect(result.intent).toBe('wallet_withdraw');
    expect(result.confidence).toBeGreaterThanOrEqual(0.8);
    expect(result.matchedKeywords).toContain('withdraw');
  });

  it('should classify escrow queries', () => {
    const result = service.classify('Tell me about BeleqetSafe escrow hold period');
    expect(result.intent).toBe('escrow_funding');
    expect(service.getSlugForIntent(result.intent)).toBe('escrow-overview');
  });

  it('should return unknown for unrelated queries', () => {
    const result = service.classify('What is the weather today?');
    expect(result.intent).toBe('unknown');
    expect(result.confidence).toBe(0);
  });
});
