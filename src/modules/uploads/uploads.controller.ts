import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProperty,
  ApiTags,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Response } from 'express';
import * as fs from 'fs';
import * as path from 'path';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { MulterFile } from './interfaces/multer-file.interface';
import { UploadsService } from './uploads.service';
import { ALLOWED_MIME_TYPES, MAX_UPLOAD_FILE_SIZE_BYTES } from './uploads.constants';

export { ALLOWED_MIME_TYPES, MAX_UPLOAD_FILE_SIZE_BYTES } from './uploads.constants';

export const UPLOAD_FILE_INTERCEPTOR_OPTIONS = {
  limits: {
    fileSize: MAX_UPLOAD_FILE_SIZE_BYTES,
  },
  fileFilter: (
    _request: unknown,
    file: { mimetype: string },
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as (typeof ALLOWED_MIME_TYPES)[number])) {
      callback(
        new BadRequestException('Invalid file type. Executables and HTML files are not allowed.'),
        false,
      );
      return;
    }

    callback(null, true);
  },
};

export class PresignedUrlDto {
  @ApiProperty({ description: 'Original file name from client', example: 'portfolio-banner.png' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  filename!: string;

  @ApiProperty({
    description: 'MIME type of the uploaded file',
    enum: ALLOWED_MIME_TYPES,
    example: 'image/png',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES, {
    message: 'Invalid file type. Executables and HTML files are not allowed.',
  })
  contentType!: string;

  @ApiProperty({
    description: 'File size in bytes. Must not exceed the upload limit.',
    maximum: MAX_UPLOAD_FILE_SIZE_BYTES,
    example: 524288,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_UPLOAD_FILE_SIZE_BYTES, {
    message: `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`,
  })
  fileSize!: number;

  @ApiProperty({
    required: false,
    description: 'Destination folder in object storage',
    example: 'profiles',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsOptional()
  @MaxLength(128)
  @Matches(/^[A-Za-z0-9][A-Za-z0-9/_-]*$/, {
    message: 'folder may only contain letters, numbers, dashes, underscores, and slashes',
  })
  folder?: string;
}

export class UploadFileDto {
  @ApiProperty({ description: 'Whether the user consented to file processing', example: 'true' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @IsNotEmpty()
  @IsString()
  @IsIn(['true', 'false'])
  hasConsentedToProcessing!: string;
}

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a secure S3 upload URL for a file' })
  async getPresignedUrl(@Body() body: PresignedUrlDto, @CurrentUser() user: CurrentUserPayload) {
    return this.uploadsService.generatePresignedUrl(
      body.filename,
      body.contentType,
      body.folder || 'misc',
      user.userId,
      body.fileSize,
    );
  }

  @Post('upload')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file securely' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        hasConsentedToProcessing: { type: 'string', example: 'true' },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file', UPLOAD_FILE_INTERCEPTOR_OPTIONS))
  async uploadFile(
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: UploadFileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const consent = body.hasConsentedToProcessing === 'true';
    return this.uploadsService.uploadFile(file, consent, user.userId);
  }

  @Post('file')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file securely (alias)' })
  @UseInterceptors(FileInterceptor('file', UPLOAD_FILE_INTERCEPTOR_OPTIONS))
  async uploadFileAlias(
    @UploadedFile() file: MulterFile | undefined,
    @Body() body: UploadFileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.uploadFile(file, body, user);
  }

  @Get('url/:folder/:filename')
  @ApiOperation({ summary: 'Get a temporary read presigned URL for a stored file key' })
  async getPresignedReadUrl(@Param('folder') folder: string, @Param('filename') filename: string) {
    return { url: await this.uploadsService.getPresignedReadUrl(`${folder}/${filename}`) };
  }

  @Delete(':folder/:filename')
  @ApiOperation({ summary: 'GDPR Soft-delete and mask a file' })
  async softDeleteFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.uploadsService.softDeleteFile(`${folder}/${filename}`, user.userId);
  }

  @Get('my-files')
  @ApiOperation({ summary: 'List all files uploaded by the active authenticated user' })
  async getMyFiles(@CurrentUser() user: CurrentUserPayload) {
    return this.uploadsService.getMyFiles(user.userId);
  }

  @Get('local-file/:folder/:filename')
  @ApiOperation({ summary: 'Serve local storage files (Development Fallback Only)' })
  async serveLocalFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!this.uploadsService.isLocalFallbackActive()) {
      throw new BadRequestException(
        'Local file serving fallback is not active in this environment.',
      );
    }

    const filePath = this.uploadsService.resolveLocalFilePath(`${folder}/${filename}`);
    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'File not found on local disk' });
    }

    res.setHeader('Content-Type', this.resolveLocalContentType(filename));
    fs.createReadStream(filePath).pipe(res);
  }

  private resolveLocalContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
    if (ext === '.png') return 'image/png';
    if (ext === '.webp') return 'image/webp';
    if (ext === '.pdf') return 'application/pdf';
    if (ext === '.doc') return 'application/msword';
    if (ext === '.docx')
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    return 'application/octet-stream';
  }
}