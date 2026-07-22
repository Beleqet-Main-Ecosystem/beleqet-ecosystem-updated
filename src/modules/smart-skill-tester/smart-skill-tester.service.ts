import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { SkillLevel as PrismaSkillLevel } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AI_CHAT_PROVIDER,
  AiChatProvider,
  AiProviderError,
} from '../resume-brain/ai/ai-chat-provider.interface';
import { GenerateQuestionsDto, SkillLevel } from './dto/generate-questions.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import {
  AiGeneratedQuestion,
  GenerateQuestionsResult,
  SubmitAnswersResult,
} from './interfaces/skill-tester.interfaces';

const REQUIRED_QUESTION_COUNT = 5;
const REQUIRED_OPTION_COUNT = 4;
const MAX_GENERATION_ATTEMPTS = 2;

@Injectable()
export class SmartSkillTesterService {
  private readonly logger = new Logger(SmartSkillTesterService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(AI_CHAT_PROVIDER) private readonly ai: AiChatProvider,
  ) {}

  async generateSession(dto: GenerateQuestionsDto): Promise<GenerateQuestionsResult> {
    this.assertGeneratePayload(dto);

    const generated = await this.requestQuestionsFromAi(dto.jobRole, dto.skillLevel);

    const session = await this.prisma.$transaction(async (tx) => {
      return tx.skillAssessmentSession.create({
        data: {
          userId: dto.userId,
          jobRole: dto.jobRole,
          skillLevel: dto.skillLevel as PrismaSkillLevel,
          questions: {
            create: generated.map((question) => ({
              questionText: question.questionText,
              options: question.options,
              correctAnswer: question.correctAnswer,
            })),
          },
        },
        include: {
          questions: {
            select: {
              id: true,
              questionText: true,
              options: true,
            },
          },
        },
      });
    });

    return {
      sessionId: session.id,
      questions: session.questions.map((question) => ({
        id: question.id,
        questionText: question.questionText,
        options: this.toStringArray(question.options),
      })),
    };
  }

  async generateQuestions(dto: GenerateQuestionsDto): Promise<GenerateQuestionsResult> {
    return this.generateSession(dto);
  }

  async submitAnswers(dto: SubmitAnswersDto): Promise<SubmitAnswersResult> {
    this.assertSubmitPayload(dto);

    const session = await this.prisma.skillAssessmentSession.findUnique({
      where: { id: dto.sessionId },
      include: { questions: true },
    });

    if (!session) {
      throw new NotFoundException({
        statusCode: HttpStatus.NOT_FOUND,
        errorCode: 'ERR_SKILL_TEST_SESSION_NOT_FOUND',
        message: 'Skill assessment session was not found.',
      });
    }

    if (session.isCompleted) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_SKILL_TEST_SESSION_CLOSED',
        message: 'This skill assessment session is already completed.',
      });
    }

    const answerByQuestionId = new Map(
      dto.answers.map((answer) => [answer.questionId, answer.selectedOption]),
    );

    let correctCount = 0;
    const graded = session.questions.map((question) => {
      const selectedOption = answerByQuestionId.get(question.id) ?? null;
      const isCorrect = selectedOption !== null && selectedOption === question.correctAnswer;

      if (isCorrect) {
        correctCount += 1;
      }

      return {
        id: question.id,
        candidateAnswer: selectedOption,
        isCorrect: selectedOption === null ? null : isCorrect,
      };
    });

    const totalQuestions = session.questions.length;
    const score = totalQuestions === 0 ? 0 : Math.round((correctCount / totalQuestions) * 100);

    await this.prisma.$transaction(async (tx) => {
      for (const gradedQuestion of graded) {
        await tx.assessmentQuestion.update({
          where: { id: gradedQuestion.id },
          data: {
            candidateAnswer: gradedQuestion.candidateAnswer,
            isCorrect: gradedQuestion.isCorrect,
          },
        });
      }

      await tx.skillAssessmentSession.update({
        where: { id: session.id },
        data: {
          score,
          isCompleted: true,
        },
      });
    });

    return {
      sessionId: session.id,
      score,
      isCompleted: true,
    };
  }

  private assertGeneratePayload(dto: GenerateQuestionsDto): void {
    if (
      dto == null ||
      typeof dto.jobRole !== 'string' ||
      !dto.jobRole.trim() ||
      typeof dto.userId !== 'string' ||
      !dto.userId.trim() ||
      dto.skillLevel == null
    ) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
        message: 'Invalid skill tester payload.',
      });
    }
  }

  private assertSubmitPayload(dto: SubmitAnswersDto): void {
    if (
      dto == null ||
      typeof dto.sessionId !== 'string' ||
      !dto.sessionId.trim() ||
      !Array.isArray(dto.answers) ||
      dto.answers.length === 0
    ) {
      throw new BadRequestException({
        statusCode: HttpStatus.BAD_REQUEST,
        errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
        message: 'Invalid skill tester payload.',
      });
    }
  }

  private async requestQuestionsFromAi(
    jobRole: string,
    skillLevel: SkillLevel,
  ): Promise<AiGeneratedQuestion[]> {
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_GENERATION_ATTEMPTS; attempt++) {
      try {
        const completion = await this.ai.complete(
          [
            { role: 'system', content: SYSTEM_PROMPT },
            {
              role: 'user',
              content: this.buildUserPrompt(jobRole, skillLevel),
            },
          ],
          { json: true, temperature: 0.3, maxTokens: 2500 },
        );

        const questions = this.parseAndValidateQuestions(completion.content);
        if (questions) {
          return questions;
        }

        this.logger.warn(
          `Skill tester AI returned invalid question payload (attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}).`,
        );
      } catch (error) {
        if (error instanceof AiProviderError) {
          throw this.toHttpException(error);
        }

        lastError = error;
        this.logger.warn(
          `Skill tester AI generation failed (attempt ${attempt}/${MAX_GENERATION_ATTEMPTS}): ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    throw this.aiGenerationFailed(lastError);
  }

  private buildUserPrompt(jobRole: string, skillLevel: SkillLevel): string {
    return (
      `Generate exactly ${REQUIRED_QUESTION_COUNT} distinct multiple-choice technical questions ` +
      `for the job role "${jobRole}" at skill level "${skillLevel}".\n` +
      'Return ONLY a JSON object matching this schema:\n' +
      '{\n' +
      '  "questions": [\n' +
      '    {\n' +
      '      "questionText": "string",\n' +
      `      "options": ["string", "string", "string", "string"],\n` +
      '      "correctAnswer": "string"\n' +
      '    }\n' +
      '  ]\n' +
      '}\n' +
      `Rules: exactly ${REQUIRED_QUESTION_COUNT} questions; each options array must contain ` +
      `exactly ${REQUIRED_OPTION_COUNT} distinct strings; correctAnswer must exactly match ` +
      'one of the options; no explanations outside JSON.'
    );
  }

  private parseAndValidateQuestions(raw: string): AiGeneratedQuestion[] | null {
    const parsed = this.parseJson(raw);
    if (!parsed) {
      return null;
    }

    const questionsValue = Array.isArray(parsed) ? parsed : parsed.questions;

    if (!Array.isArray(questionsValue) || questionsValue.length !== REQUIRED_QUESTION_COUNT) {
      return null;
    }

    const questions: AiGeneratedQuestion[] = [];
    const seenTexts = new Set<string>();

    for (const item of questionsValue) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        return null;
      }

      const record = item as Record<string, unknown>;
      const questionText = this.asNonEmptyString(record.questionText);
      const options = this.toValidatedOptions(record.options);
      const correctAnswer = this.asNonEmptyString(record.correctAnswer);

      if (!questionText || !options || !correctAnswer) {
        return null;
      }

      if (!options.includes(correctAnswer)) {
        return null;
      }

      const normalizedText = questionText.toLowerCase();
      if (seenTexts.has(normalizedText)) {
        return null;
      }
      seenTexts.add(normalizedText);

      questions.push({ questionText, options, correctAnswer });
    }

    return questions;
  }

  private parseJson(raw: string): Record<string, unknown> | unknown[] | null {
    const cleaned = raw
      .replace(/^\s*```(?:json)?/i, '')
      .replace(/```\s*$/i, '')
      .trim();

    const candidates = [cleaned, this.firstJsonObject(cleaned), this.firstJsonArray(cleaned)];

    for (const candidate of candidates) {
      if (!candidate) {
        continue;
      }

      try {
        const value = JSON.parse(candidate) as unknown;
        if (value && typeof value === 'object') {
          return value as Record<string, unknown> | unknown[];
        }
      } catch {
        continue;
      }
    }

    return null;
  }

  private firstJsonObject(text: string): string | null {
    return this.firstBalanced(text, '{', '}');
  }

  private firstJsonArray(text: string): string | null {
    return this.firstBalanced(text, '[', ']');
  }

  private firstBalanced(text: string, open: '{' | '[', close: '}' | ']'): string | null {
    const start = text.indexOf(open);
    if (start === -1) {
      return null;
    }

    let depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === open) {
        depth++;
      } else if (text[i] === close && --depth === 0) {
        return text.slice(start, i + 1);
      }
    }

    return null;
  }

  private toValidatedOptions(value: unknown): string[] | null {
    if (!Array.isArray(value) || value.length !== REQUIRED_OPTION_COUNT) {
      return null;
    }

    const options: string[] = [];
    const seen = new Set<string>();

    for (const entry of value) {
      const option = this.asNonEmptyString(entry);
      if (!option) {
        return null;
      }

      const key = option.toLowerCase();
      if (seen.has(key)) {
        return null;
      }

      seen.add(key);
      options.push(option);
    }

    return options;
  }

  private asNonEmptyString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private toStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((entry): entry is string => typeof entry === 'string');
  }

  private aiGenerationFailed(cause?: unknown): UnprocessableEntityException {
    this.logger.error(
      `Skill tester AI generation exhausted retries: ${
        cause instanceof Error ? cause.message : String(cause ?? 'invalid JSON')
      }`,
    );

    return new UnprocessableEntityException({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      errorCode: 'ERR_SKILL_TEST_AI_GENERATION_FAILED',
      message: 'Failed to generate skill assessment questions. Please try again.',
    });
  }

  private toHttpException(error: AiProviderError): HttpException {
    if (error.status === 429) {
      return new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          errorCode: 'ERR_SKILL_TEST_AI_RATE_LIMITED',
          message: 'AI provider rate limit exceeded. Please try again shortly.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    return new ServiceUnavailableException({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      errorCode: 'ERR_SKILL_TEST_AI_UNAVAILABLE',
      message: 'AI question generation is temporarily unavailable.',
    });
  }
}

const SYSTEM_PROMPT =
  'You are Beleqet Skill Tester, an expert technical interviewer. ' +
  'Produce rigorous, role-specific multiple-choice questions. ' +
  'Respond with a single JSON object only. Never include markdown or commentary.';
