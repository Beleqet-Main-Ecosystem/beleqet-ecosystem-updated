import { Test, type TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { InsightsController } from '../controllers/insights.controller';
import { InsightsService } from '../services/insights.service';

describe('InsightsController', () => {
  let controller: InsightsController;
  let prisma: { user: { findUnique: jest.Mock } };
  let insightsService: jest.Mocked<InsightsService>;

  const baseUser = {
    id: 'fl_1',
    headline: 'Senior Fullstack Developer',
    bio: 'Experienced React and Node.js developer with a passion for building great products.',
    skills: ['React', 'Node.js', 'TypeScript', 'PostgreSQL', 'Docker'],
    githubUrl: 'https://github.com/user',
    linkedinUrl: null,
    portfolioUrl: null,
    defaultResumeUrl: null,
  };

  const mockInsights = {
    optimizationScore: 85,
    profileCompleteness: 100,
    bioAnalysis: {
      length: 90,
      hasPiiWarning: false,
      containsRelevantKeywords: true,
    },
    trendingSkillsInMarket: ['GraphQL', 'Kubernetes'],
    suggestedImprovements: ['Add more skills'],
  };

  beforeEach(async () => {
    prisma = {
      user: {
        findUnique: jest.fn(),
      },
    };

    insightsService = {
      getInsights: jest.fn().mockResolvedValue(mockInsights),
    } as unknown as jest.Mocked<InsightsService>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [InsightsController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: InsightsService, useValue: insightsService },
      ],
    }).compile();

    controller = module.get<InsightsController>(InsightsController);
  });

  describe('getInsights', () => {
    it('should return profile insights for a valid freelancer', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      const result = await controller.getInsights('fl_1');

      expect(result).toBeDefined();
      expect(result.optimizationScore).toBe(85);
      expect(result.profileCompleteness).toBe(100);
      expect(insightsService.getInsights).toHaveBeenCalledWith(baseUser);
    });

    it('should throw NotFoundException when freelancer does not exist', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(controller.getInsights('nonexistent')).rejects.toThrow(NotFoundException);
    });

    it('should delegate to InsightsService with the user record', async () => {
      prisma.user.findUnique.mockResolvedValue(baseUser);

      await controller.getInsights('fl_1');

      expect(insightsService.getInsights).toHaveBeenCalledTimes(1);
      expect(insightsService.getInsights).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'fl_1' }),
      );
    });
  });
});
