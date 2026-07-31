import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { AiMatchmakerService } from './ai-matchmaker.service';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES } from '../queues/queues.constants';

describe('AiMatchmakerService — Complete Unit Test Suite', () => {
  let service: AiMatchmakerService;
  let prismaMock: any;
  let queueMock: any;

  const mockCandidate = {
    id: 'user-123',
    firstName: 'Abebe',
    lastName: 'Bikila',
    email: 'abebe@example.com',
    skills: ['TypeScript', 'React', 'NestJS', 'PostgreSQL'],
    headline: 'Senior Full Stack Developer',
    location: 'Addis Ababa',
    bio: 'BSc in Software Engineering, 5 years experience',
    gdprConsent: true,
  };

  const mockJob = {
    id: 'job-456',
    title: 'Senior NestJS Developer',
    tags: ['TypeScript', 'NestJS', 'PostgreSQL', 'Docker'],
    experienceLevel: 'SENIOR',
    requirements: 'Must have bachelor degree in computer science or software engineering',
    location: 'Addis Ababa',
    company: { name: 'Tech Ethiopia' },
  };

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
      },
      matchScore: {
        upsert: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        aggregate: jest.fn(),
      },
    };

    queueMock = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiMatchmakerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: getQueueToken(QUEUE_NAMES.AI_MATCHMAKER), useValue: queueMock },
      ],
    }).compile();

    service = module.get<AiMatchmakerService>(AiMatchmakerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueJobMatching', () => {
    it('should enqueue batch job matching task to BullMQ queue', async () => {
      prismaMock.job.findUnique.mockResolvedValue(mockJob);
      const res = await service.enqueueJobMatching('job-456');

      expect(prismaMock.job.findUnique).toHaveBeenCalledWith({ where: { id: 'job-456' } });
      expect(queueMock.add).toHaveBeenCalled();
      expect(res.queued).toBe(true);
    });

    it('should throw NotFoundException if job is not found', async () => {
      prismaMock.job.findUnique.mockResolvedValue(null);
      await expect(service.enqueueJobMatching('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('calculateAndPersistMatch', () => {
    it('should calculate weighted score and persist match in database', async () => {
      prismaMock.user.findUnique.mockResolvedValue(mockCandidate);
      prismaMock.job.findUnique.mockResolvedValue(mockJob);

      const mockSaved = {
        id: 'match-1',
        candidateId: mockCandidate.id,
        jobId: mockJob.id,
        skillScore: 75,
        experienceScore: 100,
        educationScore: 100,
        locationScore: 100,
        totalScore: 88,
        algorithmVersion: 'v1',
      };
      prismaMock.matchScore.upsert.mockResolvedValue(mockSaved);

      const result = await service.calculateAndPersistMatch(mockCandidate.id, mockJob.id);

      expect(prismaMock.user.findUnique).toHaveBeenCalledWith({ where: { id: mockCandidate.id } });
      expect(prismaMock.job.findUnique).toHaveBeenCalledWith({
        where: { id: mockJob.id },
        include: { company: { select: { name: true } } },
      });
      expect(prismaMock.matchScore.upsert).toHaveBeenCalled();
      expect(result.totalScore).toBe(88);
    });

    it('should enforce GDPR consent guard and throw ForbiddenException if gdprConsent = false', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        ...mockCandidate,
        gdprConsent: false,
      });
      prismaMock.job.findUnique.mockResolvedValue(mockJob);

      await expect(
        service.calculateAndPersistMatch(mockCandidate.id, mockJob.id),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if candidate user does not exist', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      prismaMock.job.findUnique.mockResolvedValue(mockJob);

      await expect(
        service.calculateAndPersistMatch('invalid-user', mockJob.id),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('batchCalculateForJob', () => {
    it('should process candidates with gdprConsent = true and return count', async () => {
      prismaMock.job.findUnique.mockResolvedValue(mockJob);
      prismaMock.user.findMany.mockResolvedValue([mockCandidate]);
      prismaMock.matchScore.upsert.mockResolvedValue({});

      const count = await service.batchCalculateForJob(mockJob.id);

      expect(count).toBe(1);
      expect(prismaMock.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { gdprConsent: true, role: { in: ['JOB_SEEKER', 'FREELANCER'] } } }),
      );
    });
  });

  describe('getRankedCandidatesForJob', () => {
    it('should return paginated ranked candidates filtered by minScore threshold', async () => {
      const mockRecords = [
        { id: 'm1', totalScore: 92, candidate: { firstName: 'Kebede' } },
        { id: 'm2', totalScore: 80, candidate: { firstName: 'Almaz' } },
      ];

      prismaMock.matchScore.count.mockResolvedValue(2);
      prismaMock.matchScore.findMany.mockResolvedValue(mockRecords);

      const result = await service.getRankedCandidatesForJob(mockJob.id, { minScore: 75, page: 1, limit: 10 });

      expect(result.total).toBe(2);
      expect(result.data.length).toBe(2);
      expect(prismaMock.matchScore.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { jobId: mockJob.id, totalScore: { gte: 75 } },
        }),
      );
    });
  });

  describe('getMatchAnalytics', () => {
    it('should return aggregate analytics and top skill distributions', async () => {
      prismaMock.matchScore.count
        .mockResolvedValueOnce(50) // Total
        .mockResolvedValueOnce(20); // High quality >= 75

      prismaMock.matchScore.aggregate.mockResolvedValue({
        _avg: { totalScore: 82, skillScore: 85, experienceScore: 80 },
      });

      prismaMock.matchScore.findMany.mockResolvedValue([
        { metadata: { matchedSkills: ['TypeScript', 'NestJS'] } },
        { metadata: { matchedSkills: ['TypeScript', 'React'] } },
      ]);

      const analytics = await service.getMatchAnalytics();

      expect(analytics.totalEvaluatedMatches).toBe(50);
      expect(analytics.highQualityMatchesCount).toBe(20);
      expect(analytics.averageTotalScore).toBe(82);
      expect(analytics.topSkillsDistribution.length).toBeGreaterThan(0);
    });
  });
});
