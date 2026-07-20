import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HistoryService } from './history.service';
import { PrismaService } from '../../../prisma/prisma.service';

describe('HistoryService', () => {
  let moduleRef: TestingModule;
  let historyService: HistoryService;
  const mockPrisma = {
    eventLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    moduleRef = await Test.createTestingModule({
      providers: [
        HistoryService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
 
    historyService = moduleRef.get<HistoryService>(HistoryService);
  });
 
  afterEach(async () => {
    await moduleRef?.close();
  });

  it('saves check results to event log', async () => {
    const result = {
      checkId: 'test-id',
      inputLength: 100,
      overallSimilarity: 0.1,
      maxSimilarity: 0.1,
      averageSimilarity: 0.1,
      matchCount: 0,
      verdict: 'original' as const,
      qualityScore: 0.8,
      qualityAssessment: {
        originality: 0.9,
        professionalLanguage: 0.5,
        readability: 0.7,
        contentCompleteness: 0.6,
        duplicateSentences: 0,
        grammarWarnings: [],
      },
      sourcesChecked: 5,
      internetSourcesChecked: 0,
      matches: [],
      checkedAt: new Date().toISOString(),
    };

    await historyService.save(result);

    expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'PLAGIARISM_CHECK',
          entityId: 'test-id',
        }),
      }),
    );
  });

  it('retrieves recent history', async () => {
    mockPrisma.eventLog.findMany.mockResolvedValue([
      { payload: { checkId: 'abc', verdict: 'original' } },
    ]);

    const results = await historyService.findRecent(10);
    expect(results).toHaveLength(1);
    expect(results[0].checkId).toBe('abc');
  });
});
