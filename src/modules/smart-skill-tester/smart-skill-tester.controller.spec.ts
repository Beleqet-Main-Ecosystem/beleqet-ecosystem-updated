import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SmartSkillTesterController } from './smart-skill-tester.controller';
import { SmartSkillTesterService } from './smart-skill-tester.service';

// ── Mock service ─────────────────────────────────────────────────────────────

const mockService = () => ({
  generateTest: jest.fn(),
  evaluateAnswers: jest.fn(),
  getHistory: jest.fn(),
});

// ── Test data ────────────────────────────────────────────────────────────────

const USER = { userId: 'user-1', email: 'test@test.com', role: 'JOB_SEEKER' };
const NOW = new Date('2025-01-01T00:00:00Z');

describe('SmartSkillTesterController', () => {
  let controller: SmartSkillTesterController;
  let service: jest.Mocked<SmartSkillTesterService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmartSkillTesterController],
      providers: [
        { provide: SmartSkillTesterService, useValue: mockService() },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<SmartSkillTesterController>(
      SmartSkillTesterController,
    );
    service = module.get(SmartSkillTesterService);
  });

  describe('POST /smart-skill-tester/generate', () => {
    it('delegates to service.generateTest with the authenticated user', async () => {
      const dto = { skill: 'React', questionCount: 3 };
      const expected = {
        testId: 'test-1',
        skill: 'React',
        status: 'PENDING' as const,
        questions: [
          { id: 'q-1', question: 'What is JSX?', order: 1 },
        ],
        createdAt: NOW,
      };
      service.generateTest.mockResolvedValue(expected);

      const result = await controller.generate(dto, USER);

      expect(service.generateTest).toHaveBeenCalledWith(
        'user-1',
        'React',
        3,
      );
      expect(result).toEqual(expected);
    });

    it('uses default questionCount when not provided', async () => {
      const dto = { skill: 'React' };
      service.generateTest.mockResolvedValue({
        testId: 'test-1',
        skill: 'React',
        status: 'PENDING' as const,
        questions: [],
        createdAt: NOW,
      });

      await controller.generate(dto, USER);

      expect(service.generateTest).toHaveBeenCalledWith(
        'user-1',
        'React',
        5,
      );
    });
  });

  describe('POST /smart-skill-tester/evaluate', () => {
    it('delegates to service.evaluateAnswers', async () => {
      const dto = {
        testId: 'test-1',
        answers: [
          { questionId: 'q-1', answer: 'JSX is a syntax extension...' },
        ],
      };
      const expected = {
        testId: 'test-1',
        skill: 'React',
        overallScore: 85,
        overallFeedback: 'Good.',
        results: [
          { questionId: 'q-1', score: 85, feedback: 'Nice.' },
        ],
        completedAt: NOW,
      };
      service.evaluateAnswers.mockResolvedValue(expected);

      const result = await controller.evaluate(dto, USER);

      expect(service.evaluateAnswers).toHaveBeenCalledWith(
        'user-1',
        'test-1',
        dto.answers,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('GET /smart-skill-tester/history', () => {
    it('delegates to service.getHistory', async () => {
      const expected = [
        {
          id: 'test-1',
          skill: 'React',
          status: 'EVALUATED',
          overallScore: 85,
          createdAt: NOW,
          completedAt: NOW,
          questionCount: 2,
        },
      ];
      service.getHistory.mockResolvedValue(expected);

      const result = await controller.history(USER);

      expect(service.getHistory).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expected);
    });
  });
});
