import { Test, TestingModule } from '@nestjs/testing';
import { JobsResolver } from '../resolvers/jobs.resolver';
import { PrismaService } from '@prisma-client';

describe('JobsResolver', () => {
  let resolver: JobsResolver;
  let prisma: Record<string, any>;

  const mockJob = {
    id: 'job-1',
    title: 'React Developer',
    description: 'Build amazing UIs',
    location: 'Addis Ababa',
    type: 'FULL_TIME',
    categoryId: 'cat-1',
    companyId: 'comp-1',
    status: 'PUBLISHED',
    featured: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    salaryMin: 50000,
    salaryMax: 100000,
    currency: 'ETB',
    urgent: false,
    tags: ['react', 'typescript'],
  };

  beforeEach(async () => {
    prisma = {
      job: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
      },
      company: {
        findMany: jest.fn(),
      },
      jobCategory: {
        findMany: jest.fn(),
      },
      application: {
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [JobsResolver, { provide: PrismaService, useValue: prisma }],
    }).compile();

    resolver = module.get(JobsResolver);
  });

  describe('getJobs', () => {
    it('should return paginated jobs', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);
      prisma.job.count.mockResolvedValue(1);

      const result = await resolver.getJobs({});

      expect(result.jobs).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.hasNextPage).toBe(false);
    });

    it('should filter by search term', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      prisma.job.count.mockResolvedValue(0);

      await resolver.getJobs({ search: 'React' });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.objectContaining({ contains: 'React' }) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by job type', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      prisma.job.count.mockResolvedValue(0);

      await resolver.getJobs({ type: 'REMOTE' as any });

      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'REMOTE' }),
        }),
      );
    });

    it('should paginate results', async () => {
      prisma.job.findMany.mockResolvedValue([]);
      prisma.job.count.mockResolvedValue(50);

      const result = await resolver.getJobs({ page: 2, limit: 10 });

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(5);
      expect(result.hasNextPage).toBe(true);
    });
  });

  describe('getJob', () => {
    it('should return a single job', async () => {
      prisma.job.findUnique.mockResolvedValue(mockJob);

      const result = await resolver.getJob('job-1');
      expect(result).toEqual(mockJob);
    });

    it('should return null for non-existent job', async () => {
      prisma.job.findUnique.mockResolvedValue(null);

      const result = await resolver.getJob('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('getJobsByCompany', () => {
    it('should return jobs for a company', async () => {
      prisma.job.findMany.mockResolvedValue([mockJob]);

      const result = await resolver.getJobsByCompany('comp-1');
      expect(result).toHaveLength(1);
      expect(prisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'comp-1', status: 'PUBLISHED' },
        }),
      );
    });
  });

  describe('resolveCompany', () => {
    it('should resolve company via DataLoader', async () => {
      prisma.company.findMany.mockResolvedValue([
        { id: 'comp-1', name: 'TechCorp', verified: true },
      ]);

      const result = await resolver.resolveCompany(mockJob as any);
      expect(result).toBeDefined();
      expect(result.id).toBe('comp-1');
    });
  });

  describe('resolveApplicationCount', () => {
    it('should resolve application count via DataLoader', async () => {
      prisma.application.groupBy.mockResolvedValue([{ jobId: 'job-1', _count: { id: 15 } }]);

      const result = await resolver.resolveApplicationCount(mockJob as any);
      expect(result).toBe(15);
    });
  });
});
