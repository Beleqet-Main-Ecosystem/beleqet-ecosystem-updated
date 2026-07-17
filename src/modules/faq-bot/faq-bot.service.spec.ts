import { Test, TestingModule } from '@nestjs/testing';
import { FaqBotService } from './faq-bot.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { QueryClassifierService } from './services/query-classifier.service';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import { AiStreamService } from './services/ai-stream.service';
import { FaqBotConsentService } from './services/faq-bot-consent.service';
import { FaqBotCurrencyService } from './services/faq-bot-currency.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('FaqBotService', () => {
  let service: FaqBotService;

  const mockPrisma = {
    faqBotSession: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    faqBotMessage: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqBotService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: I18nService, useValue: { t: jest.fn((key: string) => key) } },
        QueryClassifierService,
        {
          provide: KnowledgeRetrievalService,
          useValue: {
            findBySlug: jest.fn(),
            findSimilar: jest.fn(),
            localizeEntry: jest.fn().mockReturnValue({ question: 'Q', answer: 'A' }),
          },
        },
        {
          provide: AiStreamService,
          useValue: {
            streamStaticText: jest.fn().mockResolvedValue('Static answer'),
            streamAnswer: jest.fn().mockResolvedValue('AI answer'),
          },
        },
        {
          provide: FaqBotConsentService,
          useValue: {
            computeExpiresAt: jest.fn().mockReturnValue(new Date(Date.now() + 86400000)),
            assertConsent: jest.fn(),
          },
        },
        {
          provide: FaqBotCurrencyService,
          useValue: {
            buildCurrencyContext: jest.fn().mockReturnValue('currency ctx'),
            formatAmount: jest.fn().mockReturnValue('ETB 1'),
          },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = module.get<FaqBotService>(FaqBotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should reject session creation without consent', async () => {
    await expect(
      service.createSession({
        locale: 'en',
        preferredCurrency: 'ETB',
        consentGiven: false,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should create session when consent is given', async () => {
    mockPrisma.faqBotSession.create.mockResolvedValue({
      id: 'sess-1',
      locale: 'en',
      preferredCurrency: 'ETB',
      expiresAt: new Date(),
    });
    mockPrisma.faqBotMessage.create.mockResolvedValue({});

    const result = await service.createSession({
      locale: 'en',
      preferredCurrency: 'ETB',
      consentGiven: true,
      anonymousId: 'anon-12345678',
    });

    expect(result.sessionId).toBe('sess-1');
    expect(mockPrisma.faqBotSession.create).toHaveBeenCalled();
  });
});
