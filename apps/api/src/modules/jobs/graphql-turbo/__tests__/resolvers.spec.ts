import { Test, TestingModule } from '@nestjs/testing';
import { UsersResolver } from '../resolvers/users.resolver';
import { ApplicationsResolver } from '../resolvers/applications.resolver';
import { AnalyticsResolver } from '../resolvers/analytics.resolver';
import { PrismaService } from '@prisma-client';

describe('GraphQL Resolvers', () => {
  let prisma: Record<string, any>;

  const mockUser = {
    id: 'user-1',
    email: 'test@test.com',
    firstName: 'John',
    lastName: 'Doe',
    role: 'JOB_SEEKER',
    isActive: true,
    emailVerified: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    skills: ['react', 'typescript'],
  };

  const mockApplication = {
    id: 'app-1',
    jobId: 'job-1',
    userId: 'user-1',
    status: 'SUBMITTED',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      application: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        count: jest.fn(),
        groupBy: jest.fn(),
      },
      job: {
        count: jest.fn(),
      },
      company: {
        count: jest.fn(),
      },
      freelanceJob: {
        findMany: jest.fn(),
      },
      bid: {
        groupBy: jest.fn(),
      },
    };
  });

  describe('UsersResolver', () => {
    let resolver: UsersResolver;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [UsersResolver, { provide: PrismaService, useValue: prisma }],
      }).compile();
      resolver = module.get(UsersResolver);
    });

    it('should fetch a user by ID', async () => {
      prisma.user.findUnique.mockResolvedValue(mockUser);

      const result = await resolver.getUser('user-1');
      expect(result).toEqual(mockUser);
      expect(result?.id).toBe('user-1');
    });

    it('should return null for non-existent user', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await resolver.getUser('nonexistent');
      expect(result).toBeNull();
    });

    it('should fetch users with role filter', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await resolver.getUsers('JOB_SEEKER', 10);
      expect(result).toHaveLength(1);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: 'JOB_SEEKER' },
          take: 10,
        }),
      );
    });

    it('should fetch users without filter', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await resolver.getUsers();
      expect(result).toHaveLength(1);
    });
  });

  describe('ApplicationsResolver', () => {
    let resolver: ApplicationsResolver;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [ApplicationsResolver, { provide: PrismaService, useValue: prisma }],
      }).compile();
      resolver = module.get(ApplicationsResolver);
    });

    it('should fetch applications with pagination', async () => {
      prisma.application.findMany.mockResolvedValue([mockApplication]);
      prisma.application.count.mockResolvedValue(1);

      const result = await resolver.getApplications({});

      expect(result.applications).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.application.findMany.mockResolvedValue([]);
      prisma.application.count.mockResolvedValue(0);

      await resolver.getApplications({ status: 'SHORTLISTED' as any });

      expect(prisma.application.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: 'SHORTLISTED' },
        }),
      );
    });

    it('should fetch a single application', async () => {
      prisma.application.findUnique.mockResolvedValue(mockApplication);

      const result = await resolver.getApplication('app-1');
      expect(result).toEqual(mockApplication);
    });

    it('should fetch applications by job', async () => {
      prisma.application.findMany.mockResolvedValue([mockApplication]);

      const result = await resolver.getApplicationsByJob('job-1');
      expect(result).toHaveLength(1);
    });

    it('should resolve user via DataLoader', async () => {
      prisma.user.findMany.mockResolvedValue([mockUser]);

      const result = await resolver.resolveUser(mockApplication as any);
      expect(result).toBeDefined();
    });

    it('should resolve job via DataLoader', async () => {
      prisma.job.findMany = jest.fn().mockResolvedValue([{ id: 'job-1', title: 'Dev' }]);

      // We need to mock the prisma for the job loader too
      prisma.job.findMany = jest.fn().mockResolvedValue([{ id: 'job-1', title: 'Dev' }]);

      const result = await resolver.resolveJob(mockApplication as any);
      expect(result).toBeDefined();
    });
  });

  describe('AnalyticsResolver', () => {
    let resolver: AnalyticsResolver;

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [AnalyticsResolver, { provide: PrismaService, useValue: prisma }],
      }).compile();
      resolver = module.get(AnalyticsResolver);
    });

    it('should return analytics summary', async () => {
      prisma.user.count.mockResolvedValue(100);
      prisma.job.count
        .mockResolvedValueOnce(50) // totalJobs (first call)
        .mockResolvedValueOnce(40); // activeJobs (second call)
      prisma.application.count.mockResolvedValue(200);
      prisma.company.count.mockResolvedValue(20);

      const result = await resolver.getAnalyticsSummary();

      expect(result.totalUsers).toBe(100);
      expect(result.totalJobs).toBe(50);
      expect(result.totalApplications).toBe(200);
      expect(result.totalCompanies).toBe(20);
      expect(result.averageApplicationsPerJob).toBe(4); // 200/50
    });

    it('should fetch freelance jobs', async () => {
      prisma.freelanceJob.findMany.mockResolvedValue([
        { id: 'fj-1', title: 'Design Work', skills: ['figma'] },
      ]);
      prisma.bid.groupBy.mockResolvedValue([{ freelanceJobId: 'fj-1', _count: { id: 5 } }]);

      const result = await resolver.getFreelanceJobs(10);
      expect(result).toHaveLength(1);
      expect(result[0].bidCount).toBe(5);
    });
  });
});
