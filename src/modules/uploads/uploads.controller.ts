import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  UploadableFile,
  UploadContext,
  UploadsService,
  UserThemePreference,
} from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn, Matches, MaxLength } from 'class-validator';

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
] as const;

const MAX_UPLOAD_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export class PresignedUrlDto {
  @ApiProperty({
    description: 'Original file name from client',
    example: 'portfolio-banner.png',
  })
  @IsString()
  @IsNotEmpty()
  filename: string;

  @ApiProperty({
    description: 'MIME type of the uploaded file',
    enum: ALLOWED_MIME_TYPES,
    example: 'image/png',
  })
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'Invalid file type. Executables and HTML files are not allowed.',
  })
  contentType: string;

  @ApiProperty({
    required: false,
    description: 'Destination folder in object storage',
    example: 'profiles',
  })
  @IsString()
  @IsOptional()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
    message: 'folder may only contain letters, numbers, dashes, underscores, and slashes',
  })
  folder?: string;
}

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  /**
   * Generates a secure upload URL and CDN delivery URL for static assets.
   */
  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a secure S3 upload URL for a file' })
  async getPresignedUrl(
    @Body() body: PresignedUrlDto,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-theme') userThemePreference?: string,
  ): Promise<Awaited<ReturnType<UploadsService['generatePresignedUrl']>>> {
    return this.uploadsService.generatePresignedUrl(
      body.filename,
      body.contentType,
      body.folder || 'misc',
      this.resolveUploadContext(acceptLanguage, userThemePreference),
    );
  }

  /**
   * Uploads a file through the API and applies safe image optimization before storage.
   */
  @Post('file')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
      },
      fileFilter: (_request, file, callback) => {
        if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
          callback(
            new BadRequestException(
              'Invalid file type. Executables and HTML files are not allowed.',
            ),
            false,
          );
          return;
        }

        callback(null, true);
      },
    }),
  )
  @ApiOperation({ summary: 'Upload file directly to cloud storage' })
  async uploadFile(
    @UploadedFile() file: UploadableFile | undefined,
    @Headers('accept-language') acceptLanguage?: string,
    @Headers('x-user-theme') userThemePreference?: string,
  ): Promise<Awaited<ReturnType<UploadsService['uploadFile']>>> {
    if (!file) {
      throw new BadRequestException('Uploaded file is required');
    }

    return this.uploadsService.uploadFile(
      file,
      'resumes',
      this.resolveUploadContext(acceptLanguage, userThemePreference),
    );
  }

  /**
   * Extracts a stable language token from the `Accept-Language` header.
   */
  private resolveLanguage(acceptLanguage?: string): string {
    if (!acceptLanguage) {
      return 'en';
    }

    const [firstLanguage] = acceptLanguage.split(',');
    const normalized = firstLanguage.trim();
    return normalized || 'en';
  }

  /**
   * Builds the context passed into upload operations from request/global state headers.
   */
  private resolveUploadContext(
    acceptLanguage?: string,
    userThemePreference?: string,
  ): UploadContext {
    return {
      language: this.resolveLanguage(acceptLanguage),
      userThemePreference: this.resolveThemePreference(userThemePreference),
    };
  }

  /**
   * Normalizes user theme preferences to the supported global state values.
   */
  private resolveThemePreference(userThemePreference?: string): UserThemePreference {
    if (userThemePreference === 'light' || userThemePreference === 'dark') {
      return userThemePreference;
    }

    return 'system';
  }
}
