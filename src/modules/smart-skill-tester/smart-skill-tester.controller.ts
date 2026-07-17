import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
} from '@nestjs/swagger';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { SmartSkillTesterService } from './smart-skill-tester.service';
import { GenerateTestDto } from './dto/generate-test.dto';
import { EvaluateAnswersDto } from './dto/evaluate-answers.dto';

/**
 * Smart Skill Tester — AI-generated skill assessments.
 *
 * Allows authenticated users to generate skill-specific test questions via an
 * AI provider, submit answers for AI evaluation, and review their test history.
 * Every endpoint is protected by {@link JwtAuthGuard} and rate-limited via
 * {@link ThrottlerGuard}. Users can only access their own test data — the
 * service layer enforces ownership checks on every mutation.
 */
@ApiTags('smart-skill-tester')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ThrottlerGuard)
@Controller('smart-skill-tester')
export class SmartSkillTesterController {
  constructor(
    private readonly smartSkillTesterService: SmartSkillTesterService,
  ) {}

  /**
   * Generates a set of AI-powered skill test questions for the given skill.
   * The questions are created by the AI provider and persisted to the database
   * along with expected concepts (which are NOT returned to the client) so the
   * subsequent evaluation can compare answers against them.
   *
   * @param dto  - Contains the skill name and optional question count.
   * @param user - The authenticated caller, injected by `JwtAuthGuard`.
   * @returns The created test with its questions (IDs and text only).
   */
  @Post('generate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Generate AI-powered skill test questions' })
  async generate(
    @Body() dto: GenerateTestDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.smartSkillTesterService.generateTest(
      user.userId,
      dto.skill,
      dto.questionCount ?? 5,
    );
  }

  /**
   * Submits answers for a previously generated test and returns AI evaluation
   * results including per-question scores (0-100), feedback, and an overall
   * score. The test must belong to the requesting user and must not already
   * have been evaluated.
   *
   * @param dto  - Contains the test ID and an array of answer objects.
   * @param user - The authenticated caller, injected by `JwtAuthGuard`.
   * @returns Evaluation results with scores and feedback.
   */
  @Post('evaluate')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Submit answers and receive AI evaluation' })
  async evaluate(
    @Body() dto: EvaluateAnswersDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.smartSkillTesterService.evaluateAnswers(
      user.userId,
      dto.testId,
      dto.answers,
    );
  }

  /**
   * Returns the skill test history for the authenticated user, ordered by
   * most-recent-first. Each entry includes the skill, status, overall score
   * (if evaluated), timestamps, and question count.
   *
   * @param user - The authenticated caller, injected by `JwtAuthGuard`.
   * @returns An array of test history items.
   */
  @Get('history')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Get skill test history for the current user' })
  async history(@CurrentUser() user: CurrentUserPayload) {
    return this.smartSkillTesterService.getHistory(user.userId);
  }
}
