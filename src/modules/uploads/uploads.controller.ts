import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  BadRequestException,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadsService } from './uploads.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsIn } from 'class-validator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Response } from 'express';
import { MulterFile } from './interfaces/multer-file.interface';
import * as path from 'path';
import * as fs from 'fs';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
];

export class PresignedUrlDto {
  @IsString()
  @IsNotEmpty()
  filename: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(ALLOWED_MIME_TYPES, { message: 'Invalid file type. Executables and HTML files are not allowed.' })
  contentType: string;

  @IsString()
  @IsOptional()
  folder?: string;
}

export class UploadFileDto {
  @IsNotEmpty()
  @IsString()
  hasConsentedToProcessing: string;
}

@ApiTags('uploads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Post('presigned-url')
  @ApiOperation({ summary: 'Get a secure S3 upload URL for a file' })
  async getPresignedUrl(
    @Body() body: PresignedUrlDto,
    @Request() req: any,
  ) {
    const userId = req.user?.userId;
    return this.uploadsService.generatePresignedUrl(
      body.filename, 
      body.contentType, 
      body.folder || 'misc',
      userId
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: MulterFile,
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
  @UseInterceptors(FileInterceptor('file'))
  async uploadFileAlias(
    @UploadedFile() file: MulterFile,
    @Body() body: UploadFileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    return this.uploadFile(file, body, user);
  }

  @Get('url/:folder/:filename')
  @ApiOperation({ summary: 'Get a temporary read presigned URL for a stored file key' })
  async getPresignedReadUrl(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const key = `${folder}/${filename}`;
    const url = await this.uploadsService.getPresignedReadUrl(key);
    return { url };
  }

  @Delete(':folder/:filename')
  @ApiOperation({ summary: 'GDPR Soft-delete and mask a file' })
  async softDeleteFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const key = `${folder}/${filename}`;
    return this.uploadsService.softDeleteFile(key, user.userId);
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
      throw new BadRequestException('Local file serving fallback is not active in this environment.');
    }

    // Block directory traversal attempts
    if (folder.includes('..') || filename.includes('..')) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    const localStoreDir = this.uploadsService.getLocalStoreDir();
    const filePath = path.join(localStoreDir, folder, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'File not found on local disk' });
    }

    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    if (ext === '.jpg' || ext === '.jpeg') contentType = 'image/jpeg';
    else if (ext === '.png') contentType = 'image/png';
    else if (ext === '.webp') contentType = 'image/webp';
    else if (ext === '.gif') contentType = 'image/gif';
    else if (ext === '.pdf') contentType = 'application/pdf';
    else if (ext === '.txt') contentType = 'text/plain';

    res.setHeader('Content-Type', contentType);
    fs.createReadStream(filePath).pipe(res);
  }
}
