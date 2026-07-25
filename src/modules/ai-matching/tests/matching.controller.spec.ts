import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { MatchingService } from '../services/matching.service';
import { MatchingController } from '../controllers/matching.controller';
import type { MatchResult } from '../interfaces/match-result.interface';
import type { MatchRequestDto } from '../dto/match-request.dto';

describe('MatchingController', () => {
  let controller: MatchingController;
  let prisma: { freelanceJob: { findUnique: jest.Mock }; job: { findUnique: jest.Mock } };
  let matchingService: jest.Mocked<MatchingService>;

  const mockFreelanceJob = {
    id: 'job_1',
    title: 'Senior React Developer',
    description: 'Build amazing UIs.',
    skills: ['React', 'TypeScript'],
    budgetMax: 8000,
    currency: 'USD',
    clientId: 'emp_1',
    createdAt: new Date('2026-01-01'),
  };

  const mockMatchResult: MatchResult = {
    sessionId: 'session_1',
    jobId: 'job_1',
    rankedCandidates: [
      {
        freelancerId: 'fl_1',
        freelancerName: 'John Doe',
        rank: 1,
        combinedScore: 0.88,
        decision: 'STRONG_MATCH',
        reasoningSnippet: 'Great fit.',
        matchedSkills: ['React'],
        skillGaps: ['Docker'],
      },
    ],
    totalCandidatesConsidered: 1,
    completedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      freelanceJob: {
        findUnique: jest.fn(),
      },
      job: {
        findUnique: jest.fn(),
      },
    };

    matchingService = {
      match: jest.fn(),
    } as unknown as jest.Mocked<MatchingService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MatchingController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: MatchingService, useValue: matchingService },
      ],
    }).compile();

    controller = module.get<MatchingController>(MatchingController);
  });

  describe('matchCandidate', () => {
    it('should return a MatchResponseDto on success', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(mockFreelanceJob);
      matchingService.match.mockResolvedValue(mockMatchResult);

      const dto: MatchRequestDto = { jobId: 'job_1' };
      const result = await controller.matchCandidate(dto);

      expect(result).toBeDefined();
      expect(result.jobId).toBe('job_1');
      expect(result.candidates).toHaveLength(1);
      expect(result.candidates[0].freelancerId).toBe('fl_1');
    });

    it('should pass matchingOptions when provided', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(mockFreelanceJob);
      matchingService.match.mockResolvedValue(mockMatchResult);

      const dto: MatchRequestDto = {
        jobId: 'job_1',
        matchingOptions: { locale: 'am', topK: 5 },
      };
      await controller.matchCandidate(dto);

      expect(matchingService.match).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'am' }),
        { locale: 'am', topK: 5 },
      );
    });

    it('should throw NotFoundException when job does not exist', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(null);
      prisma.job.findUnique.mockResolvedValue(null);

      const dto: MatchRequestDto = { jobId: 'nonexistent' };

      await expect(controller.matchCandidate(dto)).rejects.toThrow(NotFoundException);
    });

    it('should map ranked candidates to response DTO fields', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(mockFreelanceJob);
      matchingService.match.mockResolvedValue(mockMatchResult);

      const dto: MatchRequestDto = { jobId: 'job_1' };
      const result = await controller.matchCandidate(dto);

      const candidate = result.candidates[0];
      expect(candidate).toHaveProperty('freelancerId');
      expect(candidate).toHaveProperty('rank');
      expect(candidate).toHaveProperty('score');
      expect(candidate).toHaveProperty('decision');
      expect(candidate).toHaveProperty('reasoningSnippet');
      expect(candidate).toHaveProperty('matchedSkills');
      expect(candidate).toHaveProperty('skillGaps');
    });

    it('should use locale from matchingOptions when provided', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(mockFreelanceJob);
      matchingService.match.mockResolvedValue(mockMatchResult);

      const dto: MatchRequestDto = {
        jobId: 'job_1',
        matchingOptions: { locale: 'am' },
      };
      await controller.matchCandidate(dto);

      expect(matchingService.match).toHaveBeenCalledWith(
        expect.objectContaining({ locale: 'am' }),
        expect.objectContaining({ locale: 'am' }),
      );
    });

    it('should map skills array to requiredSkills', async () => {
      prisma.freelanceJob.findUnique.mockResolvedValue(mockFreelanceJob);
      matchingService.match.mockResolvedValue(mockMatchResult);

      const dto: MatchRequestDto = { jobId: 'job_1' };
      await controller.matchCandidate(dto);

      expect(matchingService.match).toHaveBeenCalledWith(
        expect.objectContaining({
          requiredSkills: ['React', 'TypeScript'],
          preferredSkills: [],
        }),
        undefined,
      );
    });
  });
});
