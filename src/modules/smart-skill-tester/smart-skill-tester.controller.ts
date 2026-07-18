import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Post,
  UnprocessableEntityException,
  UseFilters,
  ValidationPipe,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ValidationError } from 'class-validator';
import { I18nService } from 'nestjs-i18n';
import { GenerateQuestionsDto } from './dto/generate-questions.dto';
import { SubmitAnswersDto } from './dto/submit-answers.dto';
import {
  GenerateQuestionsResult,
  SubmitAnswersResult,
} from './interfaces/skill-tester.interfaces';
import { SkillTesterInvalidPayloadFilter } from './skill-tester-invalid-payload.filter';
import { SmartSkillTesterService } from './smart-skill-tester.service';

const skillTesterValidationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  exceptionFactory: (errors: ValidationError[]) => {
    const messages = flattenValidationMessages(errors);

    return new BadRequestException({
      statusCode: HttpStatus.BAD_REQUEST,
      errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
      message:
        messages.join('; ') || 'Invalid skill tester payload.',
    });
  },
});

function flattenValidationMessages(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  return errors.flatMap((error) => {
    const propertyPath = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const current = error.constraints
      ? Object.values(error.constraints).map(
          (message) => `${propertyPath}: ${message}`,
        )
      : [];
    const nested = error.children?.length
      ? flattenValidationMessages(error.children, propertyPath)
      : [];

    return [...current, ...nested];
  });
}

@ApiTags('skill-tester')
@UseFilters(SkillTesterInvalidPayloadFilter)
@Controller('skill-tester')
export class SmartSkillTesterController {
  constructor(
    private readonly smartSkillTesterService: SmartSkillTesterService,
    private readonly i18n: I18nService,
  ) {}

  @Post('generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate dynamic skill assessment questions' })
  @ApiBody({ type: GenerateQuestionsDto })
  @ApiResponse({ status: 200, description: 'Generated question set' })
  @ApiResponse({
    status: 400,
    description: 'Invalid generate-questions payload',
  })
  @ApiResponse({
    status: 422,
    description: 'AI failed to produce a valid question set',
  })
  async generate(
    @Body(skillTesterValidationPipe) dto: GenerateQuestionsDto,
  ): Promise<GenerateQuestionsResult> {
    try {
      return await this.smartSkillTesterService.generateSession(dto);
    } catch (error) {
      throw await this.mapRouteError(error);
    }
  }

  @Post('submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit answers for a skill assessment session' })
  @ApiBody({ type: SubmitAnswersDto })
  @ApiResponse({ status: 200, description: 'Graded assessment result' })
  @ApiResponse({
    status: 400,
    description: 'Invalid submit-answers payload',
  })
  async submit(
    @Body(skillTesterValidationPipe) dto: SubmitAnswersDto,
  ): Promise<SubmitAnswersResult> {
    try {
      return await this.smartSkillTesterService.submitAnswers(dto);
    } catch (error) {
      throw await this.mapRouteError(error);
    }
  }

  private async mapRouteError(error: unknown): Promise<HttpException> {
    if (error instanceof UnprocessableEntityException) {
      return this.mapAiGenerationFailed(error);
    }

    if (error instanceof BadRequestException || error instanceof HttpException) {
      return error;
    }

    const message = await this.resolveI18nMessage(
      'messages.skillTester.requestFailed',
      'Skill tester request failed. Please try again.',
    );

    return new InternalServerErrorException({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      errorCode: 'ERR_SKILL_TEST_REQUEST_FAILED',
      message,
    });
  }

  private async mapAiGenerationFailed(
    error: UnprocessableEntityException,
  ): Promise<UnprocessableEntityException> {
    const response = error.getResponse();
    const payload =
      typeof response === 'object' && response !== null
        ? (response as Record<string, unknown>)
        : {};
    const errorCode =
      typeof payload.errorCode === 'string'
        ? payload.errorCode
        : 'ERR_SKILL_TEST_AI_GENERATION_FAILED';

    const message = await this.resolveI18nMessage(
      'messages.skillTester.aiGenerationFailed',
      'Failed to generate skill assessment questions. Please try again.',
    );

    return new UnprocessableEntityException({
      statusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      errorCode,
      message,
    });
  }

  private async resolveI18nMessage(
    key: string,
    defaultValue: string,
    args?: Record<string, unknown>,
  ): Promise<string> {
    const translated = await this.i18n.t(key, { args, defaultValue });

    if (typeof translated === 'string') {
      return translated;
    }

    return defaultValue;
  }
}
