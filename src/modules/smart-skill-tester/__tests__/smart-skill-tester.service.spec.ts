import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  AI_CHAT_PROVIDER,
  AiChatMessage,
  AiChatProvider,
  AiCompletion,
  AiUsage,
} from '../../resume-brain/ai/ai-chat-provider.interface';
import { GenerateQuestionsDto, SkillLevel } from '../dto/generate-questions.dto';
import { SubmitAnswersDto } from '../dto/submit-answers.dto';
import { SmartSkillTesterService } from '../smart-skill-tester.service';

class FakeAiProvider implements AiChatProvider {
  readonly name = 'fake';
  usage: AiUsage = {
    promptTokens: 10,
    completionTokens: 20,
    totalTokens: 30,
  };
  lastMessages: AiChatMessage[] = [];
  private queue: Array<string | (() => never)> = [];

  enqueue(...replies: Array<string | (() => never)>): void {
    this.queue.push(...replies);
  }

  async complete(messages: AiChatMessage[]): Promise<AiCompletion> {
    this.lastMessages = messages;
    const next = this.queue.shift();
    if (next === undefined) {
      throw new Error('FakeAiProvider has no queued replies');
    }
    if (typeof next === 'function') {
      return next();
    }
    return { content: next, usage: this.usage };
  }
}

function buildValidAiQuestions() {
  return {
    questions: [
      {
        questionText: 'What is a closure in JavaScript?',
        options: ['A scope leak', 'A function with lexical scope', 'A class', 'A promise'],
        correctAnswer: 'A function with lexical scope',
      },
      {
        questionText: 'Which HTTP method is idempotent?',
        options: ['POST', 'PATCH', 'GET', 'CONNECT'],
        correctAnswer: 'GET',
      },
      {
        questionText: 'What does ACID stand for in databases?',
        options: [
          'Atomicity Consistency Isolation Durability',
          'Access Control Identity Domain',
          'Array Cache Index Disk',
          'Async Compute IO Dispatch',
        ],
        correctAnswer: 'Atomicity Consistency Isolation Durability',
      },
      {
        questionText: 'Which structure provides O(1) average lookup?',
        options: ['Linked list', 'Hash map', 'Binary tree', 'Queue'],
        correctAnswer: 'Hash map',
      },
      {
        questionText: 'What is the purpose of a foreign key?',
        options: [
          'Speed up SELECT *',
          'Enforce referential integrity',
          'Encrypt rows',
          'Shard tables',
        ],
        correctAnswer: 'Enforce referential integrity',
      },
    ],
  };
}

describe('SmartSkillTesterService', () => {
  let service: SmartSkillTesterService;
  let provider: FakeAiProvider;
  let prisma: {
    $transaction: jest.Mock;
    skillAssessmentSession: {
      create: jest.Mock;
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    assessmentQuestion: {
      update: jest.Mock;
    };
  };

  const generateDto: GenerateQuestionsDto = {
    jobRole: 'Backend Engineer',
    skillLevel: SkillLevel.MID,
    userId: '550e8400-e29b-41d4-a716-446655440000',
  };

  beforeEach(async () => {
    provider = new FakeAiProvider();

    prisma = {
      $transaction: jest.fn(),
      skillAssessmentSession: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      assessmentQuestion: {
        update: jest.fn(),
      },
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SmartSkillTesterService,
        { provide: PrismaService, useValue: prisma },
        { provide: AI_CHAT_PROVIDER, useValue: provider },
      ],
    }).compile();

    service = module.get(SmartSkillTesterService);
  });

  describe('generateSession', () => {
    it('persists a session and five questions, omitting correctAnswer from the client payload', async () => {
      provider.enqueue(JSON.stringify(buildValidAiQuestions()));

      const persistedQuestions = buildValidAiQuestions().questions.map((question, index) => ({
        id: `q-${index + 1}`,
        questionText: question.questionText,
        options: question.options,
      }));

      prisma.skillAssessmentSession.create.mockResolvedValue({
        id: 'session-1',
        questions: persistedQuestions,
      });

      const result = await service.generateSession(generateDto);

      expect(provider.lastMessages[0]?.role).toBe('system');
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.skillAssessmentSession.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: generateDto.userId,
            jobRole: generateDto.jobRole,
            skillLevel: generateDto.skillLevel,
            questions: {
              create: expect.arrayContaining([
                expect.objectContaining({
                  questionText: expect.any(String),
                  options: expect.any(Array),
                  correctAnswer: expect.any(String),
                }),
              ]),
            },
          }),
        }),
      );

      const createArg = prisma.skillAssessmentSession.create.mock.calls[0][0];
      expect(createArg.data.questions.create).toHaveLength(5);

      expect(result.sessionId).toBe('session-1');
      expect(result.questions).toHaveLength(5);
      expect(result.questions[0]).toEqual({
        id: 'q-1',
        questionText: persistedQuestions[0].questionText,
        options: persistedQuestions[0].options,
      });
      expect(result.questions[0]).not.toHaveProperty('correctAnswer');
    });

    it('rejects null or incomplete payloads with ERR_SKILL_TEST_INVALID_PAYLOAD', async () => {
      await expect(
        service.generateSession(null as unknown as GenerateQuestionsDto),
      ).rejects.toBeInstanceOf(BadRequestException);

      try {
        await service.generateSession({
          jobRole: '',
          skillLevel: SkillLevel.ENTRY,
          userId: generateDto.userId,
        });
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({
            errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
          }),
        );
      }

      expect(prisma.skillAssessmentSession.create).not.toHaveBeenCalled();
    });

    it('retries after broken AI JSON then succeeds on a valid second response', async () => {
      provider.enqueue('not-json-at-all', JSON.stringify(buildValidAiQuestions()));

      prisma.skillAssessmentSession.create.mockResolvedValue({
        id: 'session-retry',
        questions: buildValidAiQuestions().questions.map((question, index) => ({
          id: `rq-${index + 1}`,
          questionText: question.questionText,
          options: question.options,
        })),
      });

      const result = await service.generateSession(generateDto);

      expect(result.sessionId).toBe('session-retry');
      expect(result.questions).toHaveLength(5);
    });

    it('throws ERR_SKILL_TEST_AI_GENERATION_FAILED after exhausting defensive retries', async () => {
      provider.enqueue('{broken', 'still-not-valid');

      try {
        await service.generateSession(generateDto);
        fail('expected UnprocessableEntityException');
      } catch (error) {
        expect(error).toBeInstanceOf(UnprocessableEntityException);
        expect((error as UnprocessableEntityException).getResponse()).toEqual(
          expect.objectContaining({
            errorCode: 'ERR_SKILL_TEST_AI_GENERATION_FAILED',
          }),
        );
      }

      expect(prisma.skillAssessmentSession.create).not.toHaveBeenCalled();
    });
  });

  describe('submitAnswers grading', () => {
    const questionRows = [
      {
        id: 'q-1',
        correctAnswer: 'A function with lexical scope',
      },
      {
        id: 'q-2',
        correctAnswer: 'GET',
      },
      {
        id: 'q-3',
        correctAnswer: 'Atomicity Consistency Isolation Durability',
      },
      {
        id: 'q-4',
        correctAnswer: 'Hash map',
      },
      {
        id: 'q-5',
        correctAnswer: 'Enforce referential integrity',
      },
    ];

    it('scores exactly 60 when 3 of 5 answers are correct', async () => {
      prisma.skillAssessmentSession.findUnique.mockResolvedValue({
        id: 'session-grade',
        isCompleted: false,
        questions: questionRows,
      });
      prisma.assessmentQuestion.update.mockResolvedValue({});
      prisma.skillAssessmentSession.update.mockResolvedValue({});

      const dto: SubmitAnswersDto = {
        sessionId: 'session-grade',
        answers: [
          { questionId: 'q-1', selectedOption: 'A function with lexical scope' },
          { questionId: 'q-2', selectedOption: 'GET' },
          {
            questionId: 'q-3',
            selectedOption: 'Atomicity Consistency Isolation Durability',
          },
          { questionId: 'q-4', selectedOption: 'Linked list' },
          { questionId: 'q-5', selectedOption: 'Encrypt rows' },
        ],
      };

      const result = await service.submitAnswers(dto);

      expect(result).toEqual({
        sessionId: 'session-grade',
        score: 60,
        isCompleted: true,
      });
      expect(prisma.assessmentQuestion.update).toHaveBeenCalledTimes(5);
      expect(prisma.skillAssessmentSession.update).toHaveBeenCalledWith({
        where: { id: 'session-grade' },
        data: { score: 60, isCompleted: true },
      });
    });

    it('throws ERR_SKILL_TEST_SESSION_CLOSED for an already completed session', async () => {
      prisma.skillAssessmentSession.findUnique.mockResolvedValue({
        id: 'session-closed',
        isCompleted: true,
        questions: questionRows,
      });

      const dto: SubmitAnswersDto = {
        sessionId: 'session-closed',
        answers: [{ questionId: 'q-1', selectedOption: 'A function with lexical scope' }],
      };

      await expect(service.submitAnswers(dto)).rejects.toBeInstanceOf(BadRequestException);

      try {
        await service.submitAnswers(dto);
      } catch (error) {
        expect((error as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({
            errorCode: 'ERR_SKILL_TEST_SESSION_CLOSED',
          }),
        );
      }

      expect(prisma.skillAssessmentSession.update).not.toHaveBeenCalled();
    });

    it('rejects null submit payloads without touching the database', async () => {
      try {
        await service.submitAnswers(null as unknown as SubmitAnswersDto);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({
            errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
          }),
        );
      }

      expect(prisma.skillAssessmentSession.findUnique).not.toHaveBeenCalled();
    });
  });
});
