import {
  Injectable,
  Inject,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AI_CHAT_PROVIDER, AiChatProvider } from '../resume-brain/ai/ai-chat-provider.interface';
import {
  AI_TEMPERATURE_GENERATE,
  AI_TEMPERATURE_EVALUATE,
  AI_MAX_TOKENS_GENERATE,
  AI_MAX_TOKENS_EVALUATE,
} from './smart-skill-tester.constants';

// ── Response shapes ──────────────────────────────────────────────────────────

export interface GeneratedTest {
  testId: string;
  skill: string;
  status: 'PENDING';
  questions: Array<{
    id: string;
    question: string;
    order: number;
  }>;
  createdAt: Date;
}

export interface EvaluationResult {
  questionId: string;
  score: number;
  feedback: string;
}

export interface EvaluateAnswersResponse {
  testId: string;
  skill: string;
  overallScore: number;
  overallFeedback: string;
  results: EvaluationResult[];
  completedAt: Date;
}

export interface TestHistoryItem {
  id: string;
  skill: string;
  status: string;
  overallScore: number | null;
  createdAt: Date;
  completedAt: Date | null;
  questionCount: number;
}

interface AiGeneratedQuestion {
  question: string;
  expectedConcepts: string[];
}

interface AiEvaluationResult {
  index: number;
  score: number;
  feedback: string;
}

interface AiEvaluationResponse {
  results: AiEvaluationResult[];
  overallScore: number;
  overallFeedback: string;
}

// ── Prompt templates ─────────────────────────────────────────────────────────

const GENERATE_SYSTEM_PROMPT = `You are a technical skill assessment expert. Create challenging but fair questions that test practical, real-world knowledge of the given skill.

Rules:
- Questions must test applied knowledge, not trivia or memorization
- Each question should be answerable in 2-5 sentences
- Include key concepts a strong answer should cover
- Return ONLY valid JSON with no markdown fences or preamble`;

const EVALUATE_SYSTEM_PROMPT = `You are a strict but fair technical skill evaluator. Evaluate each answer based on:
1. Technical accuracy (40%% of score)
2. Completeness (30%% of score)
3. Practical understanding (30%% of score)

Rules:
- Be objective and consistent
- Provide specific, actionable feedback for each answer
- Score each answer 0-100
- Calculate overallScore as the average of individual scores
- Return ONLY valid JSON with no markdown fences or preamble`;

// ── Service ──────────────────────────────────────────────────────────────────

@Injectable()
export class SmartSkillTesterService {
  private readonly logger = new Logger(SmartSkillTesterService.name);
  private readonly model: string;

  constructor(
    @Inject(AI_CHAT_PROVIDER)
    private readonly provider: AiChatProvider,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.model = this.config.get<string>('GROQ_MODEL', 'llama-3.1-8b-instant');
  }

  get providerName(): string {
    return this.provider.name;
  }

  /**
   * Generates a set of skill-test questions using the AI provider and persists
   * the test + questions to the database. The returned shape exposes only the
   * question text (no expected concepts) so the candidate cannot game the
   * evaluation.
   *
   * @param userId - The authenticated user requesting the test.
   * @param skill  - The skill to test (e.g. "React", "Node.js").
   * @param count  - Number of questions to generate (1-10).
   * @throws {BadRequestException} If the AI provider returns malformed JSON.
   * @throws {AiProviderError}      If the AI provider is unavailable.
   */
  async generateTest(userId: string, skill: string, count: number): Promise<GeneratedTest> {
    const questions = await this.generateQuestions(skill, count);

    const test = await this.prisma.skillTest.create({
      data: {
        userId,
        skill,
        status: 'PENDING',
        modelUsed: this.model,
        startedAt: new Date(),
        questions: {
          create: questions.map((q, i) => ({
            question: q.question,
            expectedConcepts: q.expectedConcepts,
            order: i + 1,
          })),
        },
      },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: { id: true, question: true, order: true },
        },
      },
    });

    return {
      testId: test.id,
      skill: test.skill,
      status: 'PENDING',
      questions: test.questions,
      createdAt: test.createdAt,
    };
  }

  /**
   * Evaluates a candidate's answers for a previously generated test. The
   * AI compares each answer against the expected concepts stored during
   * generation and returns per-question scores plus overall feedback.
   *
   * @param userId  - The authenticated user who owns the test.
   * @param testId  - ID of the test to evaluate.
   * @param answers - Array of { questionId, answer } pairs.
   * @throws {NotFoundException}    If the test does not exist.
   * @throws {ForbiddenException}   If the test belongs to a different user.
   * @throws {BadRequestException}  If the test is already evaluated, or
   *                                if the AI returns malformed JSON.
   */
  async evaluateAnswers(
    userId: string,
    testId: string,
    answers: Array<{ questionId: string; answer: string }>,
  ): Promise<EvaluateAnswersResponse> {
    const test = await this.prisma.skillTest.findUnique({
      where: { id: testId },
      include: {
        questions: { orderBy: { order: 'asc' } },
      },
    });

    if (!test) {
      throw new NotFoundException('Skill test not found');
    }
    if (test.userId !== userId) {
      throw new ForbiddenException('You do not own this skill test');
    }
    const claimed = await this.prisma.skillTest.updateMany({
      where: { id: testId, status: 'PENDING' },
      data: { status: 'IN_PROGRESS' },
    });

    if (claimed.count === 0) {
      const existing = await this.prisma.skillTest.findUnique({
        where: { id: testId },
      });
      if (!existing) {
        throw new NotFoundException('Skill test not found');
      }
      if (existing.userId !== userId) {
        throw new ForbiddenException('You do not own this skill test');
      }
      throw new ConflictException('This test has already been evaluated or is in progress');
    }

    try {
      const evaluation = await this.runEvaluation(
        test.skill,
        test.questions.map((q) => ({
          id: q.id,
          question: q.question,
          expectedConcepts: q.expectedConcepts,
        })),
        answers,
      );

      const now = new Date();

      await this.prisma.$transaction([
        ...evaluation.results.map((r) =>
          this.prisma.skillTestAnswer.create({
            data: {
              testId,
              questionId: r.questionId,
              answer: answers.find((a) => a.questionId === r.questionId)?.answer ?? '',
              score: r.score,
              feedback: r.feedback,
              evaluatedAt: now,
            },
          }),
        ),
        this.prisma.skillTest.update({
          where: { id: testId },
          data: {
            status: 'EVALUATED',
            overallScore: evaluation.overallScore,
            aiFeedback: evaluation.overallFeedback,
            completedAt: now,
          },
        }),
      ]);

      return {
        testId,
        skill: test.skill,
        overallScore: evaluation.overallScore,
        overallFeedback: evaluation.overallFeedback,
        results: evaluation.results,
        completedAt: now,
      };
    } catch (err) {
      await this.prisma.skillTest
        .update({
          where: { id: testId },
          data: { status: 'PENDING' },
        })
        .catch((resetErr) => {
          this.logger.error(
            `Failed to reset test status after evaluation error: ${(resetErr as Error).message}`,
          );
        });
      throw err;
    }
  }

  /**
   * Returns the test history for a given user, ordered most-recent-first.
   * Includes the question count derived from the relation.
   */
  async getHistory(userId: string): Promise<TestHistoryItem[]> {
    const tests = await this.prisma.skillTest.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { questions: true } },
      },
    });

    return tests.map((t) => ({
      id: t.id,
      skill: t.skill,
      status: t.status,
      overallScore: t.overallScore,
      createdAt: t.createdAt,
      completedAt: t.completedAt,
      questionCount: t._count.questions,
    }));
  }

  // ── Private: AI question generation ────────────────────────────────────────

  private async generateQuestions(skill: string, count: number): Promise<AiGeneratedQuestion[]> {
    const userPrompt = `Generate ${count} questions to test a candidate's practical knowledge of "${skill}".

Return a JSON array with exactly this shape:
[
  {
    "question": "string — the question text",
    "expectedConcepts": ["key concept a good answer should mention"]
  }
]`;

    const completion = await this.provider.complete(
      [
        { role: 'system', content: GENERATE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: AI_TEMPERATURE_GENERATE,
        maxTokens: AI_MAX_TOKENS_GENERATE,
        json: true,
      },
    );

    try {
      const parsed = JSON.parse(completion.content) as AiGeneratedQuestion[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new BadRequestException('AI returned an empty question set');
      }
      return parsed.slice(0, count).map((q) => ({
        question: q.question,
        expectedConcepts: Array.isArray(q.expectedConcepts) ? q.expectedConcepts : [],
      }));
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Failed to parse AI-generated questions: ${(err as Error).message}`);
      throw new BadRequestException('Failed to parse skill test questions from AI response');
    }
  }

  // ── Private: AI answer evaluation ─────────────────────────────────────────

  private async runEvaluation(
    skill: string,
    questions: Array<{
      id: string;
      question: string;
      expectedConcepts: string[];
    }>,
    answers: Array<{ questionId: string; answer: string }>,
  ): Promise<{
    results: EvaluationResult[];
    overallScore: number;
    overallFeedback: string;
  }> {
    const qaBlock = questions
      .map((q, i) => {
        const index = i + 1;
        const answer = answers.find((a) => a.questionId === q.id)?.answer ?? 'No answer provided';
        return `Index: ${index}
Q: ${q.question}
Expected concepts: ${q.expectedConcepts.join(', ')}
Answer: ${answer}
---`;
      })
      .join('\n');

    const userPrompt = `Evaluate these answers for a "${skill}" skill assessment.

Questions and Answers:
${qaBlock}

Return JSON with exactly this shape:
{
  "results": [
    {
      "index": number (the question index shown above as "Index: N"),
      "score": number (0-100),
      "feedback": "string — specific, actionable feedback for this answer"
    }
  ],
  "overallScore": number (average of all scores),
  "overallFeedback": "string — overall assessment of the candidate's skill level"
}`;

    const completion = await this.provider.complete(
      [
        { role: 'system', content: EVALUATE_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      {
        temperature: AI_TEMPERATURE_EVALUATE,
        maxTokens: AI_MAX_TOKENS_EVALUATE,
        json: true,
      },
    );

    try {
      const parsed = JSON.parse(completion.content) as AiEvaluationResponse;

      if (!parsed.results || !Array.isArray(parsed.results) || parsed.results.length === 0) {
        throw new BadRequestException('AI returned an empty evaluation result set');
      }

      if (parsed.results.length !== questions.length) {
        throw new BadRequestException(
          `AI returned ${parsed.results.length} result(s) for ${questions.length} question(s)`,
        );
      }

      const seenIndexes = new Set<number>();
      for (const r of parsed.results) {
        if (
          r.index == null ||
          !Number.isInteger(r.index) ||
          r.index < 1 ||
          r.index > questions.length
        ) {
          throw new BadRequestException(`AI returned an invalid question index: ${r.index}`);
        }
        if (seenIndexes.has(r.index)) {
          throw new BadRequestException(`AI returned a duplicate question index: ${r.index}`);
        }
        seenIndexes.add(r.index);
      }

      for (let i = 1; i <= questions.length; i++) {
        if (!seenIndexes.has(i)) {
          throw new BadRequestException(`AI evaluation is missing result for question index ${i}`);
        }
      }

      return {
        results: parsed.results.map((r) => {
          const qIdx = r.index - 1;
          return {
            questionId: questions[qIdx].id,
            score: Math.min(100, Math.max(0, Math.round(r.score ?? 0))),
            feedback: r.feedback ?? '',
          };
        }),
        overallScore: Math.min(100, Math.max(0, Math.round(parsed.overallScore ?? 0))),
        overallFeedback: parsed.overallFeedback ?? '',
      };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Failed to parse AI evaluation: ${(err as Error).message}`);
      throw new BadRequestException('Failed to parse skill test evaluation from AI response');
    }
  }
}
