import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard } from '@nestjs/throttler';
import { SmartSkillTesterModule } from '../src/modules/smart-skill-tester/smart-skill-tester.module';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/common/guards/jwt-auth.guard';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiCompletion,
} from '../src/modules/resume-brain/ai/ai-chat-provider.interface';

const mockUser = { userId: 'user-1', email: 'test@example.com', role: 'JOB_SEEKER' };

class MockAiProvider implements AiChatProvider {
  readonly name = 'mock-ai';

  async complete(
    messages: { role: string; content: string }[],
    _options?: unknown,
  ): Promise<AiCompletion> {
    const lastMessage = messages[messages.length - 1]?.content ?? '';

    if (lastMessage.includes('Generate')) {
      const countMatch = lastMessage.match(/Generate (\d+) questions/);
      const count = countMatch ? parseInt(countMatch[1], 10) : 2;
      const questions = Array.from({ length: count }, (_, i) => ({
        question: `Question ${i + 1}?`,
        expectedConcepts: ['concept A', 'concept B'],
      }));
      return {
        content: JSON.stringify(questions),
        usage: { promptTokens: 50, completionTokens: 30, totalTokens: 80 },
      };
    }

    // For evaluate: count how many answers the service provided
    const answerLines: string[] = [];
    for (const line of lastMessage.split('\n')) {
      if (line.startsWith('Answer: ')) answerLines.push(line);
    }

    const results = answerLines.map((_, i) => ({
      questionId: `eval-q-${i}`,
      score: Math.floor(Math.random() * 30) + 65,
      feedback: 'Good understanding demonstrated.',
    }));

    return {
      content: JSON.stringify({
        results,
        overallScore: Math.round(
          results.reduce((s, r) => s + r.score, 0) / results.length,
        ),
        overallFeedback: 'Solid grasp of the fundamentals.',
      }),
      usage: { promptTokens: 200, completionTokens: 150, totalTokens: 350 },
    };
  }
}

// ── In-memory Prisma mock (scoped per test file) ─────────────────────────────
let store: Record<string, any> = {};

const mockPrisma = {
  skillTest: {
    create: async (args: any) => {
      const id = `test-${Date.now()}`;
      const now = new Date();
      const qs = (args.data.questions?.create ?? []).map((q: any, i: number) => ({
        id: `q-${id}-${i}`, testId: id, question: q.question,
        expectedConcepts: q.expectedConcepts, order: q.order,
      }));
      const t = {
        id, userId: args.data.userId, skill: args.data.skill,
        status: 'PENDING', overallScore: null, aiFeedback: null,
        modelUsed: args.data.modelUsed ?? null, startedAt: now,
        completedAt: null, createdAt: now, updatedAt: now, questions: qs, answers: [],
      };
      store[id] = t;
      return args.include?.questions
        ? { ...t, questions: qs.map((q: any) => ({ id: q.id, question: q.question, order: q.order })) }
        : t;
    },
    findUnique: async (args: any) => {
      const t = store[args.where.id];
      if (!t) return null;
      return args.include?.questions ? { ...t, questions: t.questions } : t;
    },
    findMany: async (args: any) =>
      Object.values(store)
        .filter((t: any) => t.userId === args.where.userId)
        .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
        .map((t: any) => ({ ...t, _count: { questions: t.questions.length } })),
    update: async (args: any) => {
      Object.assign(store[args.where.id], args.data);
      return store[args.where.id];
    },
  },
  skillTestAnswer: {
    create: async (args: any) => {
      const a = { id: `ans-${Date.now()}`, ...args.data };
      store[args.data.testId]?.answers.push(a);
      return a;
    },
  },
  $transaction: async (ops: any[]) => Promise.all(ops),
};

describe('SmartSkillTester (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SmartSkillTesterModule, PrismaModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma as any)
      .overrideProvider(AI_CHAT_PROVIDER)
      .useClass(MockAiProvider)
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          context.switchToHttp().getRequest().user = mockUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    store = {};
  });

  describe('POST /api/v1/smart-skill-tester/generate', () => {
    it('returns a test with generated questions', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'React', questionCount: 2 })
        .expect(201);

      expect(res.body).toMatchObject({
        skill: 'React',
        status: 'PENDING',
        questions: expect.arrayContaining([
          expect.objectContaining({ question: expect.any(String) }),
        ]),
      });
      expect(res.body.questions).toHaveLength(2);
      expect(res.body.questions[0]).toHaveProperty('id');
      expect(res.body.questions[0]).not.toHaveProperty('expectedConcepts');
    });

    it('returns 400 for an empty skill', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: '' })
        .expect(400);
    });

    it('returns 400 for a skill shorter than 2 characters', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'A' })
        .expect(400);
    });

    it('returns 400 for questionCount above the maximum', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'React', questionCount: 99 })
        .expect(400);
    });
  });

  describe('POST /api/v1/smart-skill-tester/evaluate', () => {
    it('evaluates answers and returns scores', async () => {
      const gen = await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'React', questionCount: 2 })
        .expect(201);

      const res = await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/evaluate')
        .send({
          testId: gen.body.testId,
          answers: [
            { questionId: gen.body.questions[0].id, answer: 'JSX is a syntax extension for JavaScript.' },
            { questionId: gen.body.questions[1].id, answer: 'State is a component\'s memory.' },
          ],
        })
        .expect(201);

      expect(res.body).toMatchObject({
        testId: gen.body.testId,
        skill: 'React',
        overallScore: expect.any(Number),
        overallFeedback: expect.any(String),
        results: expect.arrayContaining([
          expect.objectContaining({
            questionId: expect.any(String),
            score: expect.any(Number),
            feedback: expect.any(String),
          }),
        ]),
      });
    });

    it('returns 404 for a non-existent test', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/evaluate')
        .send({
          testId: 'non-existent',
          answers: [{ questionId: 'q-1', answer: 'test' }],
        })
        .expect(404);
    });

    it('returns 400 for a test that was already evaluated', async () => {
      const gen = await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'React', questionCount: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/evaluate')
        .send({
          testId: gen.body.testId,
          answers: [{ questionId: gen.body.questions[0].id, answer: 'First attempt' }],
        })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/evaluate')
        .send({
          testId: gen.body.testId,
          answers: [{ questionId: gen.body.questions[0].id, answer: 'Second attempt' }],
        })
        .expect(400);
    });
  });

  describe('GET /api/v1/smart-skill-tester/history', () => {
    it('returns an empty array when no tests exist', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/smart-skill-tester/history')
        .expect(200);

      expect(res.body).toEqual([]);
    });

    it('returns completed tests with scores', async () => {
      const gen = await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/generate')
        .send({ skill: 'React', questionCount: 1 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/api/v1/smart-skill-tester/evaluate')
        .send({
          testId: gen.body.testId,
          answers: [{ questionId: gen.body.questions[0].id, answer: 'Test answer' }],
        })
        .expect(201);

      const res = await request(app.getHttpServer())
        .get('/api/v1/smart-skill-tester/history')
        .expect(200);

      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toMatchObject({
        id: expect.any(String),
        skill: 'React',
        status: expect.any(String),
        questionCount: expect.any(Number),
      });
    });
  });
});
