import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { I18n, I18nContext } from 'nestjs-i18n';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { UploadResumeDto } from './dto/upload-resume.dto';
import { RESUME_ALLOWED_MIME_TYPES } from './resume-brain.service';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeUploadFile } from './resume-upload-file.interface';

/** Maximum accepted upload size at the interceptor level (bytes), matched by service-level validation. */
const MULTER_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

/**
 * REST controller for uploading CVs and retrieving/erasing their parsed results.
 */
@ApiTags('resumes')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('resumes')
export class ResumeBrainController {
  constructor(private readonly resumeBrainService: ResumeBrainService) {}

  /**
   * Uploads a CV file (PDF/DOC/DOCX), parses it, and extracts structured data.
   *
   * @param file - The uploaded CV file.
   * @param dto - Upload metadata, including required GDPR consent.
   * @param user - Current authenticated professional.
   * @returns The stored upload record together with its parsed result.
   */
  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a CV (PDF/DOC/DOCX) for AI-assisted parsing' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MULTER_MAX_FILE_SIZE_BYTES },
      fileFilter: (_req, file, callback) => {
        if (!RESUME_ALLOWED_MIME_TYPES.includes(file.mimetype)) {
          return callback(
            new BadRequestException(
              `Unsupported file type "${file.mimetype}". Only PDF, DOC, and DOCX files are accepted.`,
            ),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: ResumeUploadFile,
    @Body() dto: UploadResumeDto,
    @CurrentUser() user: CurrentUserPayload,
    @I18n() i18n: I18nContext,
  ) {
    return this.resumeBrainService.uploadAndProcess(user.userId, file, dto.consent, i18n.lang);
  }

  /**
   * Retrieves a previously uploaded CV's stored metadata and parsed result.
   *
   * @param id - `ResumeUpload` ID.
   * @param user - Current authenticated professional.
   */
  @Get(':id')
  @ApiOperation({ summary: 'Retrieve a parsed resume by ID' })
  async getById(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @I18n() i18n: I18nContext,
  ) {
    return this.resumeBrainService.getResume(user.userId, id, i18n.lang);
  }

  /**
   * Permanently deletes a CV and its parsed data (GDPR right-to-erasure).
   *
   * @param id - `ResumeUpload` ID.
   * @param user - Current authenticated professional.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Permanently delete a resume and its parsed data (GDPR erasure)' })
  async remove(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
    @I18n() i18n: I18nContext,
  ): Promise<void> {
    await this.resumeBrainService.deleteResume(user.userId, id, i18n.lang);
  }
}
