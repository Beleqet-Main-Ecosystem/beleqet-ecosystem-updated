import { Test, TestingModule } from '@nestjs/testing';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const mockEntries = [
  {
    id: '1',
    slug: 'wallet-withdrawal',
    category: 'wallet',
    questionEn: 'How to withdraw?',
    questionAm: null,
    answerEn: 'Use the wallet page.',
    answerAm: null,
    keywords: ['withdraw', 'wallet'],
    currency: 'ETB',
    embedding: [1, 0, 0],
    isPublished: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockPrismaService = {
  faqKnowledgeEntry: {
    findFirst: jest.fn(),
    findMany: jest.fn().mockResolvedValue(mockEntries),
  },
};

describe('KnowledgeRetrievalService', () => {
  let service: KnowledgeRetrievalService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeRetrievalService,
        { provide: PrismaService, useValue: mockPrismaService },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
      ],
    }).compile();

    service = module.get<KnowledgeRetrievalService>(KnowledgeRetrievalService);
  });

  it('should compute cosine similarity correctly', () => {
    expect(service.cosineSimilarity([1, 0, 0], [1, 0, 0])).toBe(1);
    expect(service.cosineSimilarity([1, 0, 0], [0, 1, 0])).toBe(0);
  });

  it('should find entries by keywords', async () => {
    const results = await service.findByKeywords('I need to withdraw money');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('wallet-withdrawal');
  });

  it('should localize entries by locale', () => {
    const localized = service.localizeEntry(mockEntries[0], 'en');
    expect(localized.question).toBe('How to withdraw?');
  });
});
