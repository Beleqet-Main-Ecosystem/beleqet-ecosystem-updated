import { getQueueToken } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisCacheService } from '../cache/redis-cache.service';
import { JOBS_LIST_CACHE_REGISTRY_KEY } from '../cache/cache.constants';
import { QUEUE_NAMES } from '../queues/queues.constants';
import { JobType } from './dto/create-job.dto';
import { JobsService } from './jobs.service';

jest.mock('../notifications/email-templates', () => ({
  jobPostConfirmationEmail: jest.fn().mockResolvedValue({ html: '<p>ok</p>', text: 'ok' }),
  jobAlertEmail: jest.fn().mockResolvedValue({ html: '<p>ok</p>', text: 'ok' }),
}), { virtual: true });

describe('JobsService cache integration', () => {
  let service: JobsService;
  let prisma: {
    user: { findUnique: jest.Mock; findMany: jest.Mock };
    company: { findUnique: jest.Mock };
    job: {
      create: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
    jobCategory: { findMany: jest.Mock };
  };
  let cache: {
    getOrSet: jest.Mock<Promise<unknown>, [string, () => Promise<unknown>, number, string?]>;
    invalidateRegisteredKeys: jest.Mock<Promise<void>, [string]>;
  };

  beforeEach(async () => {
    prisma = {
      user: { findUnique: jest.fn(), findMany: jest.fn() },
      company: { findUnique: jest.fn() },
      job: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      jobCategory: { findMany: jest.fn() },
    };

    cache = {
      getOrSet: jest.fn(),
      invalidateRegisteredKeys: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, fallback?: string | number) => fallback),
          },
        },
        { provide: RedisCacheService, useValue: cache },
        { provide: getQueueToken(QUEUE_NAMES.NOTIFICATIONS), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<JobsService>(JobsService);
  });

  it('loads public job lists from Prisma on cache miss and registers the list key', async () => {
    cache.getOrSet.mockImplementation(async (_key, loader) => loader());
    prisma.job.findMany.mockResolvedValue([{ id: 'job-1' }]);
    prisma.job.count.mockResolvedValue(1);

    const result = await service.findAll({ q: ' engineer ', page: 1, limit: 10 }, 'EN');

    expect(result).toEqual({ items: [{ id: 'job-1' }], total: 1, page: 1, limit: 10, totalPages: 1 });
    expect(cache.getOrSet).toHaveBeenCalledWith(
      expect.stringMatching(/^jobs:list:/),
      expect.any(Function),
      60_000,
      JOBS_LIST_CACHE_REGISTRY_KEY,
    );
    expect(prisma.job.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 0,
        take: 10,
      }),
    );
    expect(prisma.job.count).toHaveBeenCalledTimes(1);
  });

  it('returns cached public job lists without querying Prisma', async () => {
    cache.getOrSet.mockResolvedValue({
      items: [{ id: 'cached-job' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });

    const result = await service.findAll({}, 'en');

    expect(result).toEqual({
      items: [{ id: 'cached-job' }],
      total: 1,
      page: 1,
      limit: 20,
      totalPages: 1,
    });
    expect(prisma.job.findMany).not.toHaveBeenCalled();
    expect(prisma.job.count).not.toHaveBeenCalled();
  });

  it('loads public job details from Prisma on cache miss', async () => {
    cache.getOrSet.mockImplementation(async (_key, loader) => loader());
    prisma.job.findUnique.mockResolvedValue({ id: 'job-1', title: 'Backend Engineer' });

    const result = await service.findOne('job-1', 'en');

    expect(result).toEqual({ id: 'job-1', title: 'Backend Engineer' });
    expect(cache.getOrSet).toHaveBeenCalledWith(
      'jobs:detail:en:job-1',
      expect.any(Function),
      60_000,
      'jobs:detail:registry:job-1',
    );
    expect(prisma.job.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'job-1' } }),
    );
  });

  it('returns cached public job details without querying Prisma', async () => {
    cache.getOrSet.mockResolvedValue({ id: 'cached-job' });

    await expect(service.findOne('job-1', 'en')).resolves.toEqual({ id: 'cached-job' });
    expect(prisma.job.findUnique).not.toHaveBeenCalled();
  });

  it('caches public job categories by locale', async () => {
    cache.getOrSet.mockImplementation(async (_key, loader) => loader());
    prisma.jobCategory.findMany.mockResolvedValue([{ slug: 'engineering', label: 'Engineering' }]);

    const result = await service.getCategories('EN');

    expect(result).toEqual([{ slug: 'engineering', label: 'Engineering' }]);
    expect(cache.getOrSet).toHaveBeenCalledWith('jobs:categories:en', expect.any(Function), 300_000);
    expect(prisma.jobCategory.findMany).toHaveBeenCalledWith({ orderBy: { label: 'asc' } });
  });

  it('invalidates public job list cache after creating a job', async () => {
    prisma.user.findUnique.mockResolvedValue({ firstName: 'Aster', email: 'aster@example.com' });
    prisma.user.findMany.mockResolvedValue([]);
    prisma.company.findUnique.mockResolvedValue({ id: 'company-1' });
    prisma.job.create.mockResolvedValue({
      id: 'job-1',
      title: 'Backend Engineer',
      company: { name: 'Beleqet' },
    });

    await service.create('employer-1', {
      title: 'Backend Engineer',
      description: 'Build APIs',
      location: 'Addis Ababa',
      type: JobType.REMOTE,
      categoryId: 'category-1',
    });

    expect(cache.invalidateRegisteredKeys).toHaveBeenCalledWith(JOBS_LIST_CACHE_REGISTRY_KEY);
  });

  it('invalidates public list and detail caches after updating a job', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-1' });
    prisma.job.update.mockResolvedValue({ id: 'job-1', title: 'Updated' });

    await service.update('job-1', 'employer-1', { title: 'Updated' });

    expect(cache.invalidateRegisteredKeys).toHaveBeenCalledWith(JOBS_LIST_CACHE_REGISTRY_KEY);
    expect(cache.invalidateRegisteredKeys).toHaveBeenCalledWith('jobs:detail:registry:job-1');
  });

  it('invalidates public list and detail caches after archiving a job', async () => {
    prisma.job.findFirst.mockResolvedValue({ id: 'job-1' });
    prisma.job.update.mockResolvedValue({ id: 'job-1', status: 'ARCHIVED' });

    await service.remove('job-1', 'employer-1');

    expect(cache.invalidateRegisteredKeys).toHaveBeenCalledWith(JOBS_LIST_CACHE_REGISTRY_KEY);
    expect(cache.invalidateRegisteredKeys).toHaveBeenCalledWith('jobs:detail:registry:job-1');
  });
});
