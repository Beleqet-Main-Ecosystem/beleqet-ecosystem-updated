import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiCompletion,
} from '../resume-brain/ai/ai-chat-provider.interface';
import { SmartSkillTesterService } from './smart-skill-tester.service';

const mockProvider = (): jest.Mocked<AiChatProvider> => ({
  name: 'groq',
  complete: jest.fn(),
});

const mockPrisma = () => ({
  skillTest: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  skillTestAnswer: {
    create: jest.fn(),
  },
  $transaction: jest.fn(),
});

const mockConfig = () => ({
  get: jest.fn((key: string, defaultValue?: unknown) => defaultValue),
});

const USER_ID = 'user-1';
const SKILL = 'React';
const TEST_ID = 'test-1';
const NOW = new Date('2025-01-01T00:00:00Z');

const AI_QUESTIONS_RESPONSE: AiCompletion = {
  content: JSON.stringify([
    {
      question: 'What is the virtual DOM?',
      expectedConcepts: ['virtual DOM', 'diffing', 'reconciliation'],
    },
    {
      question: 'Explain useState vs useReducer.',
      expectedConcepts: ['useState', 'useReducer', 'state management'],
    },
  ]),
  usage: { promptTokens: 100, completionTokens: 80, totalTokens: 180 },
};

const EVALUATION_RESPONSE: AiCompletion = {
  content: JSON.stringify({
    results: [
      { index: 1, score: 85, feedback: 'Good explanation.' },
      { index: 2, score: 70, feedback: 'Could be more detailed.' },
    ],
    overallScore: 77.5,
    overallFeedback: 'Solid understanding of React basics.',
  }),
  usage: { promptTokens: 200, completionTokens: 120, totalTokens: 320 },
};

describe('SmartSkillTesterService', () => {
  let service: SmartSkillTesterService;
  let provider: jest.Mocked<AiChatProvider>;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    provider = mockProvider();
    prisma = mockPrisma();

    jest.useFakeTimers().setSystemTime(NOW);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartSkillTesterService,
        { provide: AI_CHAT_PROVIDER, useValue: provider },
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: mockConfig() },
      ],
    }).compile();

    service = module.get<SmartSkillTesterService>(SmartSkillTesterService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // ── generateTest ───────────────────────────────────────────────────────────

  describe('generateTest', () => {
    it('generates questions via AI and persists the test', async () => {
      provider.complete.mockResolvedValue(AI_QUESTIONS_RESPONSE);
      prisma.skillTest.create.mockResolvedValue({
        id: TEST_ID,
        userId: USER_ID,
        skill: SKILL,
        status: 'PENDING',
        modelUsed: 'llama-3.1-8b-instant',
        startedAt: NOW,
        completedAt: null,
        overallScore: null,
        aiFeedback: null,
        createdAt: NOW,
        updatedAt: NOW,
        questions: [
          {
            id: 'q-1',
            question: 'What is the virtual DOM?',
            order: 1,
            expectedConcepts: ['virtual DOM', 'diffing', 'reconciliation'],
            testId: TEST_ID,
          },
          {
            id: 'q-2',
            question: 'Explain useState vs useReducer.',
            order: 2,
            expectedConcepts: ['useState', 'useReducer', 'state management'],
            testId: TEST_ID,
          },
        ],
        answers: [],
      });

      const result = await service.generateTest(USER_ID, SKILL, 2);

      expect(provider.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(SKILL),
          }),
        ]),
        expect.objectContaining({ json: true }),
      );

      expect(prisma.skillTest.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: USER_ID,
            skill: SKILL,
            status: 'PENDING',
          }),
        }),
      );

      expect(result).toEqual({
        testId: TEST_ID,
        skill: SKILL,
        status: 'PENDING',
        questions: expect.arrayContaining([
          expect.objectContaining({ question: 'What is the virtual DOM?' }),
          expect.objectContaining({
            question: 'Explain useState vs useReducer.',
          }),
        ]),
        createdAt: NOW,
      });
    });

    it('throws BadRequestException when AI returns empty question array', async () => {
      provider.complete.mockResolvedValue({
        content: JSON.stringify([]),
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      await expect(
        service.generateTest(USER_ID, SKILL, 2),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when AI returns malformed JSON', async () => {
      provider.complete.mockResolvedValue({
        content: 'not-json-at-all',
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });

      await expect(
        service.generateTest(USER_ID, SKILL, 2),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── evaluateAnswers ────────────────────────────────────────────────────────

  describe('evaluateAnswers', () => {
    const existingTest = {
      id: TEST_ID,
      userId: USER_ID,
      skill: SKILL,
      status: 'PENDING' as const,
      overallScore: null,
      aiFeedback: null,
      modelUsed: 'llama-3.1-8b-instant',
      startedAt: NOW,
      completedAt: null,
      createdAt: NOW,
      updatedAt: NOW,
      questions: [
        {
          id: 'q-1',
          testId: TEST_ID,
          question: 'What is the virtual DOM?',
          expectedConcepts: ['virtual DOM', 'diffing', 'reconciliation'],
          order: 1,
        },
        {
          id: 'q-2',
          testId: TEST_ID,
          question: 'Explain useState vs useReducer.',
          expectedConcepts: ['useState', 'useReducer', 'state management'],
          order: 2,
        },
      ],
      answers: [],
    };

    const answers = [
      { questionId: 'q-1', answer: 'The virtual DOM is a lightweight copy...' },
      { questionId: 'q-2', answer: 'useState is for simple state...' },
    ];

    it('evaluates answers and persists results', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      provider.complete.mockResolvedValue(EVALUATION_RESPONSE);
      prisma.$transaction.mockImplementation(async (cb: any) => cb);
      prisma.skillTestAnswer.create.mockReturnValue({} as any);

      const result = await service.evaluateAnswers(USER_ID, TEST_ID, answers);

      expect(prisma.skillTest.updateMany).toHaveBeenCalledWith({
        where: { id: TEST_ID, status: 'PENDING' },
        data: { status: 'IN_PROGRESS' },
      });

      expect(provider.complete).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ role: 'system' }),
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining(SKILL),
          }),
        ]),
        expect.objectContaining({ json: true }),
      );

      expect(prisma.$transaction).toHaveBeenCalled();

      expect(result).toEqual({
        testId: TEST_ID,
        skill: SKILL,
        overallScore: 78,
        overallFeedback: 'Solid understanding of React basics.',
        results: [
          { questionId: 'q-1', score: 85, feedback: 'Good explanation.' },
          { questionId: 'q-2', score: 70, feedback: 'Could be more detailed.' },
        ],
        completedAt: NOW,
      });
    });

    it('throws NotFoundException when test does not exist', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(null);

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when test belongs to another user', async () => {
      prisma.skillTest.findUnique.mockResolvedValue({
        ...existingTest,
        userId: 'other-user',
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws ConflictException when test is already evaluated', async () => {
      prisma.skillTest.findUnique.mockResolvedValue({
        ...existingTest,
        status: 'EVALUATED',
      });
      prisma.skillTest.updateMany.mockResolvedValue({ count: 0 });
      prisma.skillTest.findUnique.mockResolvedValueOnce({
        ...existingTest,
        status: 'EVALUATED',
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(ConflictException);
    });

    it('resets test status to PENDING when AI evaluation fails', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      provider.complete.mockRejectedValue(new Error('AI timeout'));
      prisma.skillTest.update.mockResolvedValue({} as any);

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow();

      expect(prisma.skillTest.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_ID },
          data: { status: 'PENDING' },
        }),
      );
    });

    it('throws BadRequestException when AI returns fewer results than questions', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      prisma.skillTest.update.mockResolvedValue({} as any);
      provider.complete.mockResolvedValue({
        content: JSON.stringify({
          results: [{ index: 1, score: 80, feedback: 'Good.' }],
          overallScore: 80,
          overallFeedback: 'OK',
        }),
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when AI returns duplicate indexes', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      prisma.skillTest.update.mockResolvedValue({} as any);
      provider.complete.mockResolvedValue({
        content: JSON.stringify({
          results: [
            { index: 1, score: 80, feedback: 'Good.' },
            { index: 1, score: 90, feedback: 'Great.' },
          ],
          overallScore: 85,
          overallFeedback: 'OK',
        }),
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when AI returns an out-of-range index', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      prisma.skillTest.update.mockResolvedValue({} as any);
      provider.complete.mockResolvedValue({
        content: JSON.stringify({
          results: [
            { index: 1, score: 80, feedback: 'Good.' },
            { index: 99, score: 90, feedback: 'Great.' },
          ],
          overallScore: 85,
          overallFeedback: 'OK',
        }),
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when AI misses a required index', async () => {
      prisma.skillTest.findUnique.mockResolvedValue(existingTest);
      prisma.skillTest.updateMany.mockResolvedValue({ count: 1 });
      prisma.skillTest.update.mockResolvedValue({} as any);
      provider.complete.mockResolvedValue({
        content: JSON.stringify({
          results: [
            { index: 1, score: 80, feedback: 'Good.' },
            { index: 3, score: 90, feedback: 'Great.' },
          ],
          overallScore: 85,
          overallFeedback: 'OK',
        }),
        usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
      });

      await expect(
        service.evaluateAnswers(USER_ID, TEST_ID, answers),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── getHistory ─────────────────────────────────────────────────────────────

  describe('getHistory', () => {
    it('returns test history ordered by newest first', async () => {
      prisma.skillTest.findMany.mockResolvedValue([
        {
          id: TEST_ID,
          userId: USER_ID,
          skill: SKILL,
          status: 'EVALUATED',
          overallScore: 78,
          aiFeedback: 'Great work',
          modelUsed: 'llama-3.1-8b-instant',
          startedAt: NOW,
          completedAt: NOW,
          createdAt: NOW,
          updatedAt: NOW,
          _count: { questions: 2 },
        },
        {
          id: 'test-2',
          userId: USER_ID,
          skill: 'TypeScript',
          status: 'PENDING',
          overallScore: null,
          aiFeedback: null,
          modelUsed: 'llama-3.1-8b-instant',
          startedAt: NOW,
          completedAt: null,
          createdAt: new Date(NOW.getTime() - 3600000),
          updatedAt: new Date(NOW.getTime() - 3600000),
          _count: { questions: 3 },
        },
      ]);

      const result = await service.getHistory(USER_ID);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        id: TEST_ID,
        skill: SKILL,
        status: 'EVALUATED',
        overallScore: 78,
        createdAt: NOW,
        completedAt: NOW,
        questionCount: 2,
      });
    });

    it('returns empty array for a user with no tests', async () => {
      prisma.skillTest.findMany.mockResolvedValue([]);

      const result = await service.getHistory(USER_ID);

      expect(result).toEqual([]);
    });
  });
});
