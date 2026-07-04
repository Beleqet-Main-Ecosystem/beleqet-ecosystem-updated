import {
  Body,
  Controller,
  Headers,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadableFile, UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

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
    example: 'image/png',
  })
  @IsString()
  @IsNotEmpty()
  contentType: string;

  @ApiProperty({
    required: false,
    description: 'Destination folder in object storage',
    example: 'profiles',
  })
  @IsString()
  @IsOptional()
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
  ) {
    return this.uploadsService.generatePresignedUrl(
      body.filename,
      body.contentType,
      body.folder || 'misc',
      this.resolveLanguage(acceptLanguage),
    );
  }

  /**
   * Uploads a file through API and applies optimization before storage.
   */
  @Post('file')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload file directly to cloud storage' })
  async uploadFile(
    @UploadedFile() file: UploadableFile,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    return this.uploadsService.uploadFile(file, 'resumes', this.resolveLanguage(acceptLanguage));
  }

  /**
   * Extracts a stable language token from Accept-Language for i18n responses.
   */
  private resolveLanguage(acceptLanguage?: string): string {
    if (!acceptLanguage) {
      return 'en';
    }
    const [firstLanguage] = acceptLanguage.split(',');
    const normalized = firstLanguage.trim();
    return normalized || 'en';
  }
}
