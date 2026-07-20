import {
  Controller,
  Get,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  CurrentUserPayload,
} from '../../common/decorators/current-user.decorator';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { MAX_FILE_SIZE_BYTES } from './resume-brain.constants';

@ApiTags('resume-brain')
@Controller('resume-brain')
export class ResumeBrainController {
  constructor(private readonly resumeBrainService: ResumeBrainService) {}

  @Get('health')
  @ApiOperation({ summary: 'Resume Brain module health check' })
  health() {
    return this.resumeBrainService.health();
  }

  // NOTE: `ThrottlerGuard` is applied explicitly here. The app configures
  // `ThrottlerModule.forRoot` but never binds the guard globally (no APP_GUARD),
  // so a bare `@Throttle` decorator would be inert. Listing it in `@UseGuards`
  // alongside `JwtAuthGuard` makes the per-endpoint limits below actually
  // enforce for this module.

  @Post('upload')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 uploads / minute
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Upload a resume (PDF/DOCX, max 5MB) and echo back its metadata',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    // Multer enforces the 5MB limit and raises 413 Payload Too Large on its own.
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  upload(@UploadedFile() file: UploadedResumeFile) {
    return this.resumeBrainService.describeUpload(file);
  }

  @Post('parse')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } }) // 10 parses / minute
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Upload a resume (PDF/DOCX, max 5MB) and extract its plain text (no AI yet)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  parse(@UploadedFile() file: UploadedResumeFile) {
    return this.resumeBrainService.parseResume(file);
  }

  @Post('extract')
  @UseGuards(JwtAuthGuard, ThrottlerGuard)
  // Tighter than upload/parse: this is the only endpoint that calls the paid AI
  // provider. The burst cap here plus the per-user daily budget in the service
  // (AiBudgetService) together bound both abuse rate and cumulative cost.
  @Throttle({ default: { limit: 5, ttl: 60_000 } }) // 5 AI extractions / minute
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Upload a resume (PDF/DOCX, max 5MB), parse it and return a structured ' +
      'profile as JSON (Phase 4 — AI extraction)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_FILE_SIZE_BYTES } }),
  )
  extract(
    @UploadedFile() file: UploadedResumeFile,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.resumeBrainService.extractProfile(file, user?.userId);
  }
}
