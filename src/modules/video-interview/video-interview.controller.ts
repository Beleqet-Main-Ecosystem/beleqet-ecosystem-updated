import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { VideoInterviewService } from './video-interview.service';
import { CreateInterviewSessionDto } from './dto/create-interview-session.dto';
import { SubmitResponseDto } from './dto/submit-response.dto';

/**
 * REST controller for the AI Video Interview module.
 *
 * All routes require JWT authentication.
 * i18n locale is resolved from the `Accept-Language` header (default: en).
 *
 * @prefix /api/v1/video-interviews
 */
@ApiTags('video-interviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('video-interviews')
export class VideoInterviewController {
  constructor(private readonly service: VideoInterviewService) {}

  /**
   * Create a new video interview session for a job application.
   * Only the employer who owns the job may call this endpoint.
   */
  @Post()
  @ApiOperation({ summary: 'Create an AI video interview session (employer only)' })
  createSession(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateInterviewSessionDto,
    @Headers('accept-language') lang = 'en',
  ) {
    return this.service.createSession(user.id, dto, lang);
  }

  /**
   * Retrieve a video interview session with responses and evaluation.
   * Candidates may only view their own session.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get a video interview session' })
  @ApiParam({ name: 'id', description: 'VideoInterview UUID' })
  getSession(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Headers('accept-language') lang = 'en',
  ) {
    return this.service.getSession(id, user.id, lang);
  }

  /**
   * List all interview sessions for a given application (employer view).
   */
  @Get('application/:applicationId')
  @ApiOperation({ summary: 'List interview sessions for an application (employer only)' })
  @ApiParam({ name: 'applicationId', description: 'Application UUID' })
  listByApplication(
    @Param('applicationId') applicationId: string,
    @CurrentUser() user: { id: string },
    @Headers('accept-language') lang = 'en',
  ) {
    return this.service.listByApplication(applicationId, user.id, lang);
  }

  /**
   * Submit a video response for a single interview question.
   * Immediately enqueues a Whisper transcription job.
   */
  @Post(':id/responses')
  @ApiOperation({ summary: 'Submit a video response for an interview question' })
  @ApiParam({ name: 'id', description: 'VideoInterview UUID' })
  submitResponse(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Body() dto: SubmitResponseDto,
    @Headers('accept-language') lang = 'en',
  ) {
    return this.service.submitResponse(id, user.id, dto, lang);
  }

  /**
   * Request GDPR deletion of all interview data.
   * Clears PII immediately; video files are removed by the nightly cleanup job.
   */
  @Delete(':id/gdpr')
  @ApiOperation({ summary: 'Request GDPR deletion of all interview data' })
  @ApiParam({ name: 'id', description: 'VideoInterview UUID' })
  requestGdprDeletion(
    @Param('id') id: string,
    @CurrentUser() user: { id: string },
    @Headers('accept-language') lang = 'en',
  ) {
    return this.service.requestGdprDeletion(id, user.id, lang);
  }
}
