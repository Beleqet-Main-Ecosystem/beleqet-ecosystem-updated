import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { StorageService } from './storage.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';

import { IsNotEmpty, IsString } from 'class-validator';

/**
 * DTO for validating file upload inputs and GDPR consent.
 */
export class UploadFileDto {
  /**
   * String representation of the user's data processing consent.
   * Required under GDPR guidelines.
   */
  @IsNotEmpty()
  @IsString()
  hasConsentedToProcessing: string;
}

/**
 * Controller exposing REST endpoints for cloud storage and file management operations.
 * Implements strict user auth guard validation and GDPR data privacy checks.
 */
@ApiTags('storage')
@Controller('storage')
export class StorageController {
  constructor(private readonly storageService: StorageService) {}

  /**
   * Endpoint to securely upload a file. Requires JWT Auth and multipart/form-data payload.
   *
   * @param file - The uploaded file block from Multer.
   * @param body - The body fields containing GDPR consent confirmation.
   * @param user - The authenticated user payload injected by Passport.
   * @returns Resolves with the created StoredFile database record.
   * @throws BadRequestException if the file is missing, exceeds size limits, or consent is absent.
   * @security GDPR/Auth: Block uploads if consent is false. Tracks ownership with User ID.
   */
  @Post('upload')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Upload a file (avatar, resume, portfolio) securely' })
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
    @UploadedFile() file: Express.Multer.File,
    @Body() body: UploadFileDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    if (!file) {
      throw new BadRequestException('No file uploaded.');
    }

    const consent = body.hasConsentedToProcessing === 'true';
    return this.storageService.uploadFile(file, consent, user.userId);
  }

  /**
   * Endpoint to retrieve a secure, temporary presigned URL for viewing a file.
   *
   * @param folder - File folder category (images, documents).
   * @param filename - File uuid name with extension.
   * @returns Resolves with an object containing the secure URL.
   * @throws NotFoundException if the file is missing or soft-deleted.
   * @security Auth: Accessible to logged-in users only. Blocked if file is flagged as deleted.
   */
  @Get('url/:folder/:filename')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get a temporary read presigned URL for a stored file key' })
  async getPresignedReadUrl(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const key = `${folder}/${filename}`;
    const url = await this.storageService.getPresignedReadUrl(key);
    return { url };
  }

  /**
   * Endpoint to perform GDPR-compliant soft-deletion of files.
   *
   * @param folder - File folder category (images, documents).
   * @param filename - File uuid name.
   * @returns Resolves with the deleted and masked file metadata record.
   * @throws NotFoundException if file doesn't exist.
   * @security Auth: Soft-deletes underlying storage object and masks database fields.
   */
  @Delete(':folder/:filename')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'GDPR Soft-delete and mask a file' })
  async softDeleteFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
  ) {
    const key = `${folder}/${filename}`;
    return this.storageService.softDeleteFile(key);
  }

  /**
   * Public endpoint to serve local files. Used ONLY as fallback during local development.
   *
   * @param folder - Folder path (images or documents).
   * @param filename - Filename key of the stored resource.
   * @param res - Express Response object to stream file content.
   * @returns Streams the local file payload.
   * @throws BadRequestException if the file path is invalid.
   * @security Sandboxed directory check prevents Directory Traversal exploits.
   */
  @Get('local-file/:folder/:filename')
  @ApiOperation({ summary: 'Serve local storage files (Development Fallback Only)' })
  async serveLocalFile(
    @Param('folder') folder: string,
    @Param('filename') filename: string,
    @Res() res: Response,
  ) {
    if (!this.storageService.isLocalFallbackActive()) {
      throw new BadRequestException('Local file serving fallback is not active in this environment.');
    }

    // Block directory traversal attempts
    if (folder.includes('..') || filename.includes('..')) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    const localStoreDir = this.storageService.getLocalStoreDir();
    const filePath = path.join(localStoreDir, folder, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: 'File not found on local disk' });
    }

    // Determine correct MIME type mapping
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

  /**
   * Endpoint to retrieve all active files uploaded by the currently authenticated user.
   *
   * @param user - The authenticated user payload injected by Passport.
   * @returns Resolves with an array of StoredFile database records.
   * @security Auth: Requires JWT verification. Restricts query to the active user's own uploads.
   */
  @Get('my-files')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List all files uploaded by the active authenticated user' })
  async getMyFiles(@CurrentUser() user: CurrentUserPayload) {
    return this.storageService.getMyFiles(user.userId);
  }
}
