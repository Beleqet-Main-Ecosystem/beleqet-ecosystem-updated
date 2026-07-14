import { Test, TestingModule } from '@nestjs/testing';
import { SearchIndexProcessor } from './search-index.processor';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  freelanceJob: { findUnique: jest.fn() },
  job: { findUnique: jest.fn() },
};

describe('SearchIndexProcessor', () => {
  let processor: SearchIndexProcessor;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchIndexProcessor,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    processor = module.get<SearchIndexProcessor>(SearchIndexProcessor);
  });

  describe('indexJob', () => {
    it('should index a freelance job', async () => {
      mockPrisma.freelanceJob.findUnique.mockResolvedValue({
        id: 'g1', title: 'Build Website', description: 'desc', skills: ['React'],
      });
      const job = { data: { action: 'upsert', entityType: 'freelance_job', entityId: 'g1' } } as any;
      const result = await processor.indexJob(job);
      expect(result).toBeUndefined();
    });

    it('should index a regular job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({
        id: 'j1', title: 'Dev', description: 'desc',
      });
      const job = { data: { action: 'upsert', entityType: 'job', entityId: 'j1' } } as any;
      const result = await processor.indexJob(job);
      expect(result).toBeUndefined();
    });

    it('should handle delete action', async () => {
      const job = { data: { action: 'delete', entityType: 'job', entityId: 'j1' } } as any;
      const result = await processor.indexJob(job);
      expect(result).toBeUndefined();
    });

    it('should handle unknown entityType gracefully', async () => {
      const job = { data: { action: 'upsert', entityType: 'unknown', entityId: 'x1' } } as any;
      const result = await processor.indexJob(job);
      expect(result).toBeUndefined();
    });
  });
});
