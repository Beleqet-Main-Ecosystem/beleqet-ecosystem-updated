import { BadRequestException, UnprocessableEntityException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { I18nService } from 'nestjs-i18n';
import { GenerateQuestionsDto, SkillLevel } from '../dto/generate-questions.dto';
import { SubmitAnswersDto } from '../dto/submit-answers.dto';
import { SmartSkillTesterController } from '../smart-skill-tester.controller';
import { SmartSkillTesterService } from '../smart-skill-tester.service';

describe('SmartSkillTesterController', () => {
  let controller: SmartSkillTesterController;
  let service: jest.Mocked<Pick<SmartSkillTesterService, 'generateSession' | 'submitAnswers'>>;
  let i18nService: { t: jest.Mock };

  const generateDto: GenerateQuestionsDto = {
    jobRole: 'Backend Engineer',
    skillLevel: SkillLevel.MID,
    userId: '550e8400-e29b-41d4-a716-446655440000',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    service = {
      generateSession: jest.fn(),
      submitAnswers: jest.fn(),
    };

    i18nService = {
      t: jest.fn(
        async (_key: string, options?: { defaultValue?: string }) =>
          options?.defaultValue ?? 'translated',
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SmartSkillTesterController],
      providers: [
        { provide: SmartSkillTesterService, useValue: service },
        { provide: I18nService, useValue: i18nService },
      ],
    }).compile();

    controller = module.get(SmartSkillTesterController);
  });

  describe('generate', () => {
    it('delegates to generateSession and returns the typed result', async () => {
      const result = {
        sessionId: 'session-1',
        questions: [
          {
            id: 'q-1',
            questionText: 'What is REST?',
            options: ['A', 'B', 'C', 'D'],
          },
        ],
      };
      service.generateSession.mockResolvedValue(result);

      await expect(controller.generate(generateDto)).resolves.toEqual(result);
      expect(service.generateSession).toHaveBeenCalledWith(generateDto);
    });

    it('maps AI generation failures to ERR_SKILL_TEST_AI_GENERATION_FAILED via i18n', async () => {
      service.generateSession.mockRejectedValue(
        new UnprocessableEntityException({
          statusCode: 422,
          errorCode: 'ERR_SKILL_TEST_AI_GENERATION_FAILED',
          message: 'Failed to generate skill assessment questions.',
        }),
      );
      i18nService.t.mockResolvedValue('Translated AI generation failure');

      await expect(controller.generate(generateDto)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );

      try {
        await controller.generate(generateDto);
      } catch (error) {
        expect((error as UnprocessableEntityException).getResponse()).toEqual({
          statusCode: 422,
          errorCode: 'ERR_SKILL_TEST_AI_GENERATION_FAILED',
          message: 'Translated AI generation failure',
        });
      }

      expect(i18nService.t).toHaveBeenCalledWith(
        'messages.skillTester.aiGenerationFailed',
        expect.objectContaining({
          defaultValue: 'Failed to generate skill assessment questions. Please try again.',
        }),
      );
    });
  });

  describe('submit', () => {
    it('returns grading results from the service', async () => {
      const dto: SubmitAnswersDto = {
        sessionId: 'session-1',
        answers: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440001',
            selectedOption: 'GET',
          },
        ],
      };
      const graded = {
        sessionId: 'session-1',
        score: 60,
        isCompleted: true,
      };
      service.submitAnswers.mockResolvedValue(graded);

      await expect(controller.submit(dto)).resolves.toEqual(graded);
      expect(service.submitAnswers).toHaveBeenCalledWith(dto);
    });

    it('propagates ERR_SKILL_TEST_SESSION_CLOSED from the service', async () => {
      const dto: SubmitAnswersDto = {
        sessionId: 'session-closed',
        answers: [
          {
            questionId: '550e8400-e29b-41d4-a716-446655440001',
            selectedOption: 'GET',
          },
        ],
      };
      service.submitAnswers.mockRejectedValue(
        new BadRequestException({
          statusCode: 400,
          errorCode: 'ERR_SKILL_TEST_SESSION_CLOSED',
          message: 'This skill assessment session is already completed.',
        }),
      );

      try {
        await controller.submit(dto);
        fail('expected BadRequestException');
      } catch (error) {
        expect(error).toBeInstanceOf(BadRequestException);
        expect((error as BadRequestException).getResponse()).toEqual(
          expect.objectContaining({
            errorCode: 'ERR_SKILL_TEST_SESSION_CLOSED',
          }),
        );
      }
    });
  });

  describe('DTO validation (null / unauthorized payloads)', () => {
    it('rejects a nullish generate payload shape', async () => {
      const dto = plainToInstance(GenerateQuestionsDto, {
        jobRole: null,
        skillLevel: null,
        userId: null,
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((error) => ['jobRole', 'skillLevel', 'userId'].includes(error.property)),
      ).toBe(true);
    });

    it('rejects a submit payload with empty answers', async () => {
      const dto = plainToInstance(SubmitAnswersDto, {
        sessionId: '550e8400-e29b-41d4-a716-446655440000',
        answers: [],
      });

      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((error) => error.property === 'answers')).toBe(true);
    });
  });
});
