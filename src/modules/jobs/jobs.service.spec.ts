import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bull';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { PrismaService } from '../../prisma/prisma.service';

const mockPrisma = {
  user: { findUnique: jest.fn(), findMany: jest.fn() },
  company: { findUnique: jest.fn() },
  job: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
  jobCategory: { findMany: jest.fn() },
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    return fallback;
  }),
};

const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };

jest.mock('../notifications/email-templates', () => ({
  jobPostConfirmationEmail: jest.fn().mockResolvedValue({ html: '<p>test</p>', text: 'test' }),
  jobAlertEmail: jest.fn().mockResolvedValue({ html: '<p>test</p>', text: 'test' }),
}));

describe('JobsService', () => {
  let svc: JobsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
      ],
    }).compile();
    svc = module.get<JobsService>(JobsService);
  });

  describe('create', () => {
    it('should throw ForbiddenException if employer has no company', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'John', email: 'john@test.com' });
      mockPrisma.company.findUnique.mockResolvedValue(null);

      await expect(
        svc.create('employer-1', { title: 'Dev', description: 'desc', location: 'Addis', type: 'FULL_TIME', categoryId: 'cat-1' } as any),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should create a job and enqueue notifications', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ firstName: 'John', email: 'john@test.com' });
      mockPrisma.company.findUnique.mockResolvedValue({ id: 'comp-1' });
      mockPrisma.job.create.mockResolvedValue({ id: 'job-1', title: 'Dev', company: { name: 'Acme' }, category: { label: 'Tech' } });
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await svc.create('employer-1', {
        title: 'Dev', description: 'desc', location: 'Addis', type: 'FULL_TIME', categoryId: 'cat-1',
      } as any);

      expect(result.id).toBe('job-1');
      expect(mockPrisma.job.create).toHaveBeenCalled();
      expect(mockNotificationsQueue.add).toHaveBeenCalled();
    });
  });

  describe('getCategories', () => {
    it('should return categories', async () => {
      mockPrisma.jobCategory.findMany.mockResolvedValue([{ id: '1', label: 'Tech' }]);
      const result = await svc.getCategories();
      expect(result).toHaveLength(1);
    });
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      mockPrisma.job.findMany.mockResolvedValue([{ id: 'job-1' }]);
      mockPrisma.job.count.mockResolvedValue(1);

      const result = await svc.findAll({ page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by type and category', async () => {
      mockPrisma.job.findMany.mockResolvedValue([]);
      mockPrisma.job.count.mockResolvedValue(0);

      await svc.findAll({ type: 'FULL_TIME' as any, category: 'tech', q: 'dev', location: 'Addis' });

      expect(mockPrisma.job.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'PUBLISHED' }) }),
      );
    });
  });

  describe('findOne', () => {
    it('should return a job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue({ id: 'job-1', company: {}, category: {}, _count: { applications: 0 } });
      const result = await svc.findOne('job-1');
      expect(result.id).toBe('job-1');
    });

    it('should throw NotFoundException for missing job', async () => {
      mockPrisma.job.findUnique.mockResolvedValue(null);
      await expect(svc.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update a job', async () => {
      mockPrisma.job.findFirst.mockResolvedValue({ id: 'job-1' });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', title: 'Updated' });

      const result = await svc.update('job-1', 'employer-1', { title: 'Updated' });
      expect(result.title).toBe('Updated');
    });

    it('should throw NotFoundException if job not found or not owned by employer', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);
      await expect(svc.update('job-1', 'employer-1', { title: 'x' })).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should archive a job', async () => {
      mockPrisma.job.findFirst.mockResolvedValue({ id: 'job-1' });
      mockPrisma.job.update.mockResolvedValue({ id: 'job-1', status: 'ARCHIVED' });

      const result = await svc.remove('job-1', 'employer-1');
      expect(result.status).toBe('ARCHIVED');
    });

    it('should throw NotFoundException if not found', async () => {
      mockPrisma.job.findFirst.mockResolvedValue(null);
      await expect(svc.remove('missing', 'employer-1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByCompany', () => {
    it('should return jobs for an employer', async () => {
      mockPrisma.job.findMany.mockResolvedValue([{ id: 'job-1' }]);
      const result = await svc.findByCompany('employer-1');
      expect(result).toHaveLength(1);
    });
  });
});
