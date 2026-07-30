import { Test, TestingModule } from '@nestjs/testing';
import { AiStreamService } from './services/ai-stream.service';
import { ConfigService } from '@nestjs/config';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';

describe('AiStreamService', () => {
  let service: AiStreamService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiStreamService,
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => undefined) },
        },
        {
          provide: KnowledgeRetrievalService,
          useValue: {
            localizeEntry: jest.fn().mockReturnValue({ question: 'Q', answer: 'Static answer text.' }),
          },
        },
      ],
    }).compile();

    service = module.get<AiStreamService>(AiStreamService);
  });

  it('should report unavailable when OpenAI key is missing', () => {
    expect(service.isAvailable()).toBe(false);
  });

  it('should stream fallback answer when OpenAI is unavailable', async () => {
    const tokens: string[] = [];
    const result = await service.streamFallbackAnswer(
      [
        {
          id: '1',
          slug: 'test',
          category: 'wallet',
          questionEn: 'Q',
          questionAm: null,
          answerEn: 'Static answer text.',
          answerAm: null,
          keywords: [],
          currency: null,
          embedding: null,
          isPublished: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      'en',
      (token) => tokens.push(token),
    );

    expect(result).toBe('Static answer text.');
    expect(tokens.join('')).toBe('Static answer text.');
  });
});
