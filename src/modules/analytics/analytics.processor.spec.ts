import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsProcessor } from './analytics.processor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  eventLog: { create: jest.fn() },
  application: { count: jest.fn() },
};

describe('AnalyticsProcessor', () => {
  let processor: AnalyticsProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    processor = module.get<AnalyticsProcessor>(AnalyticsProcessor);
  });

  describe('logEvent', () => {
    it('should log an analytics event', async () => {
      mockPrisma.eventLog.create.mockResolvedValue({});
      const job = { data: { eventType: 'page.view', jobId: 'j1' } } as any;
      await processor.logEvent(job);
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith({
        data: {
          eventType: 'page.view',
          entityId: 'j1',
          entityType: 'Analytics',
          payload: { eventType: 'page.view', jobId: 'j1' },
          processedBy: 'AnalyticsProcessor',
        },
      });
    });

    it('should use "global" as entityId if no jobId or applicationId', async () => {
      mockPrisma.eventLog.create.mockResolvedValue({});
      const job = { data: { eventType: 'app.start' } } as any;
      await processor.logEvent(job);
      expect(mockPrisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ entityId: 'global' }),
        }),
      );
    });
  });

  describe('updateJobStats', () => {
    it('should count applications for a job', async () => {
      mockPrisma.application.count.mockResolvedValue(42);
      const job = { data: { jobId: 'j1' } } as any;
      await processor.updateJobStats(job);
      expect(mockPrisma.application.count).toHaveBeenCalledWith({ where: { jobId: 'j1' } });
    });
  });
});
