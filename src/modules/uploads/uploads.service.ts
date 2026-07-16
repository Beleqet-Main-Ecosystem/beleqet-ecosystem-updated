import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { StoredFile } from '@prisma/client';
import { promises as fs } from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterFile } from './interfaces/multer-file.interface';
import {
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MIME_TYPE_EXTENSIONS,
} from './uploads.constants';

interface OptimizedAsset {
  buffer: Buffer;
  contentType: AllowedMimeType;
  extension: string;
  optimized: boolean;
}

@Injectable()
export class UploadsService {
  private s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly localStoreDir: string;
  private readonly immutableCacheControl: string;
  private useLocalFallback = false;
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
    this.localStoreDir = this.config.get<string>(
      'UPLOAD_LOCAL_DIR',
      path.join(process.cwd(), 'temp-storage'),
    );
    this.immutableCacheControl = this.config.get<string>(
      'CDN_CACHE_CONTROL',
      'public, max-age=31536000, immutable',
    );

    const region = this.config.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId =
      this.config.get<string>('R2_ACCESS_KEY_ID') ?? this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey =
      this.config.get<string>('R2_SECRET_ACCESS_KEY') ??
      this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint =
      this.config.get<string>('AWS_ENDPOINT') ??
      (this.config.get<string>('R2_ACCOUNT_ID')
        ? `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
        : undefined);

    const hasValidCredentials =
      accessKeyId &&
      accessKeyId !== 'your_access_key' &&
      secretAccessKey &&
      secretAccessKey !== 'your_secret_key';

    if (hasValidCredentials) {
      this.s3Client = new S3Client({
        region,
        ...(endpoint && { endpoint }),
        credentials: { accessKeyId, secretAccessKey },
      });
      this.logger.log('S3/R2 Storage client initialized successfully.');
    } else {
      this.useLocalFallback = true;
      this.logger.warn(
        `AWS/R2 credentials are missing or default. Falling back to local disk storage at: ${this.localStoreDir}`,
      );
      void fs.mkdir(this.localStoreDir, { recursive: true }).catch((error) => {
        this.logger.error(
          `Failed to initialize local upload directory: ${(error as Error).message}`,
        );
      });
    }
  }

  isLocalFallbackActive(): boolean {
    return this.useLocalFallback;
  }

  getLocalStoreDir(): string {
    return this.localStoreDir;
  }

  async generatePresignedUrl(
    filename: string,
    contentType: string,
    folder = 'misc',
    userId?: string,
    fileSize = 0,
  ): Promise<{ presignedUrl: string; publicUrl: string; key: string; cacheControl: string }> {
    this.assertAllowedMimeType(contentType);
    this.assertFileSize(fileSize || 1);

    const targetFolder = this.validateStorageFolder(folder);
    const extension = this.resolveSafeExtension(contentType);
    const key = `${targetFolder}/${uuidv4()}${extension}`;

    let presignedUrl: string;
    if (this.useLocalFallback) {
      presignedUrl = this.buildLocalUrl(key);
    } else {
      if (!this.s3Client) {
        throw new InternalServerErrorException('Cloud storage client not initialized');
      }

      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        CacheControl: this.immutableCacheControl,
      });
      presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    }

    await this.prisma.storedFile.create({
      data: {
        key,
        filename: this.sanitizeFilename(filename),
        mimeType: contentType,
        size: fileSize,
        hasConsentedToProcessing: true,
        uploadedById: userId || null,
      },
    });

    return {
      presignedUrl,
      publicUrl: this.buildPublicUrl(key),
      key,
      cacheControl: this.immutableCacheControl,
    };
  }

  async uploadFile(
    file: MulterFile,
    folderOrConsent: string | boolean = 'misc',
    userId?: string,
  ): Promise<
    StoredFile & {
      publicUrl: string;
      cacheControl: string;
      contentType: string;
      optimized: boolean;
    }
  > {
    const { folder, hasConsentedToProcessing } = this.resolveUploadTarget(
      folderOrConsent,
      file?.mimetype,
    );

    if (!hasConsentedToProcessing) {
      throw new BadRequestException('GDPR data processing consent is mandatory to upload files.');
    }

    this.assertUploadableFile(file);
    const targetFolder = this.validateStorageFolder(folder);
    const optimizedAsset = await this.optimizeAsset(file);
    const key = `${targetFolder}/${uuidv4()}${optimizedAsset.extension}`;

    try {
      if (this.useLocalFallback) {
        const localPath = this.resolveLocalFilePath(key);
        await fs.mkdir(path.dirname(localPath), { recursive: true });
        await fs.writeFile(localPath, optimizedAsset.buffer);
        this.logger.debug(`File written locally to: ${localPath}`);
      } else {
        if (!this.s3Client) {
          throw new InternalServerErrorException('Cloud storage client not initialized');
        }

        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: optimizedAsset.buffer,
          ContentType: optimizedAsset.contentType,
          CacheControl: this.immutableCacheControl,
        });
        await this.s3Client.send(command);
        this.logger.debug(`File uploaded to S3: ${key}`);
      }

      const storedFile = await this.prisma.storedFile.create({
        data: {
          key,
          filename: this.sanitizeFilename(file.originalname),
          mimeType: optimizedAsset.contentType,
          size: optimizedAsset.buffer.length,
          hasConsentedToProcessing,
          uploadedById: userId || null,
        },
      });

      return {
        ...storedFile,
        publicUrl: this.buildPublicUrl(key),
        cacheControl: this.immutableCacheControl,
        contentType: optimizedAsset.contentType,
        optimized: optimizedAsset.optimized,
      };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(
        `Upload error details: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw new InternalServerErrorException('Failed to process and store the file.');
    }
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    const safeKey = this.validateStorageKey(key);
    const record = await this.prisma.storedFile.findUnique({ where: { key: safeKey } });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The requested file does not exist or has been deleted.');
    }

    try {
      if (this.useLocalFallback) {
        return this.buildLocalUrl(record.key);
      }

      if (!this.s3Client) {
        throw new InternalServerErrorException('Cloud storage client not initialized');
      }

      const command = new GetObjectCommand({ Bucket: this.bucket, Key: record.key });
      return await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(`Error generating presigned read URL: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve secure file URL.');
    }
  }

  async softDeleteFile(key: string, userId: string): Promise<StoredFile> {
    const safeKey = this.validateStorageKey(key);
    const record = await this.prisma.storedFile.findUnique({ where: { key: safeKey } });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The file does not exist or has already been deleted.');
    }

    if (record.uploadedById !== userId) {
      throw new ForbiddenException('You do not have permission to delete this file.');
    }

    try {
      if (this.useLocalFallback) {
        await fs
          .unlink(this.resolveLocalFilePath(record.key))
          .catch((error: NodeJS.ErrnoException) => {
            if (error.code !== 'ENOENT') {
              throw error;
            }
          });
      } else {
        if (!this.s3Client) {
          throw new InternalServerErrorException('Cloud storage client not initialized');
        }

        await this.s3Client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: record.key }));
      }

      const updated = await this.prisma.storedFile.update({
        where: { key: record.key },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          filename: 'DELETED_GDPR_COMPLIANCE_MASKED',
        },
      });

      this.logger.log(`GDPR Soft-delete completed for file key: ${record.key}`);
      return updated;
    } catch (error) {
      if (error instanceof InternalServerErrorException) {
        throw error;
      }

      this.logger.error(`Error during file soft-deletion: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to delete file.');
    }
  }

  async getMyFiles(userId: string): Promise<StoredFile[]> {
    try {
      return await this.prisma.storedFile.findMany({
        where: { uploadedById: userId, isDeleted: false },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error retrieving user files: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve files list.');
    }
  }

  resolveLocalFilePath(key: string): string {
    const safeKey = this.validateStorageKey(key);
    const localPath = path.resolve(this.localStoreDir, safeKey);
    const localRoot = path.resolve(this.localStoreDir);

    if (localPath !== localRoot && !localPath.startsWith(`${localRoot}${path.sep}`)) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    return localPath;
  }

  private resolveUploadTarget(folderOrConsent: string | boolean, mimeType?: string) {
    if (typeof folderOrConsent === 'boolean') {
      return {
        hasConsentedToProcessing: folderOrConsent,
        folder: this.isImageMimeType(mimeType || '') ? 'images' : 'documents',
      };
    }

    return { hasConsentedToProcessing: true, folder: folderOrConsent };
  }

  private async optimizeAsset(file: MulterFile): Promise<OptimizedAsset> {
    const contentType = this.assertAllowedMimeType(file.mimetype);

    if (this.isImageMimeType(contentType)) {
      const webpBuffer = await this.convertImageToWebp(file.buffer);
      return { buffer: webpBuffer, contentType: 'image/webp', extension: '.webp', optimized: true };
    }

    return {
      buffer: file.buffer,
      contentType,
      extension: this.resolveSafeExtension(contentType),
      optimized: false,
    };
  }

  private assertUploadableFile(file?: MulterFile): asserts file is MulterFile {
    if (!file || !file.buffer || !file.mimetype || !file.originalname) {
      throw new BadRequestException('Invalid file payload.');
    }

    this.assertAllowedMimeType(file.mimetype);
    this.assertFileSize(file.size ?? file.buffer.length);
  }

  private assertFileSize(fileSize: number): void {
    if (!Number.isInteger(fileSize) || fileSize < 1) {
      throw new BadRequestException('Invalid file size.');
    }

    if (fileSize > MAX_UPLOAD_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`,
      );
    }
  }

  private assertAllowedMimeType(mimeType: string): AllowedMimeType {
    if (!ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType)) {
      throw new BadRequestException(
        'Invalid file type. Executables and HTML files are not allowed.',
      );
    }

    return mimeType as AllowedMimeType;
  }

  private isImageMimeType(mimeType: string): boolean {
    return mimeType === 'image/jpeg' || mimeType === 'image/png' || mimeType === 'image/webp';
  }

  private async convertImageToWebp(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer).webp({ quality: 80 }).toBuffer();
    } catch {
      throw new BadRequestException('Uploaded image is invalid or corrupted');
    }
  }

  private validateStorageFolder(folder: string): string {
    const normalized = folder
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized || normalized.length > 128) {
      throw new BadRequestException('Invalid upload folder');
    }

    let decodedFolder = normalized;
    try {
      decodedFolder = decodeURIComponent(normalized);
    } catch {
      throw new BadRequestException('Invalid upload folder');
    }

    const segments = decodedFolder.split('/');
    const hasUnsafeSegment = segments.some(
      (segment) => !/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(segment),
    );

    if (hasUnsafeSegment) {
      throw new BadRequestException('Invalid upload folder');
    }

    return segments.join('/');
  }

  private validateStorageKey(key: string): string {
    const normalized = key
      .trim()
      .replace(/\\/g, '/')
      .replace(/^\/+|\/+$/g, '');

    if (!normalized || normalized.length > 255) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    let decodedKey = normalized;
    try {
      decodedKey = decodeURIComponent(normalized);
    } catch {
      throw new BadRequestException('Invalid file key pathway.');
    }

    const segments = decodedKey.split('/');
    if (segments.length !== 2) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    const [folder, filename] = segments;
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/.test(folder)) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    if (!/^[0-9a-f-]{36}\.(jpg|png|webp|pdf|doc|docx)$/i.test(filename)) {
      throw new BadRequestException('Invalid file key pathway.');
    }

    return `${folder}/${filename}`;
  }

  private resolveSafeExtension(contentType: string): string {
    const allowedMimeType = this.assertAllowedMimeType(contentType);
    return MIME_TYPE_EXTENSIONS[allowedMimeType];
  }

  private sanitizeFilename(filename: string): string {
    const normalized = filename.replace(/\\/g, '/');
    const basename = normalized.split('/').pop()?.trim() || 'upload';
    return basename.slice(0, 255);
  }

  private buildPublicUrl(key: string): string {
    if (this.useLocalFallback) {
      return this.buildLocalUrl(key);
    }

    const cdnBaseUrl = this.config.get<string>('CDN_BASE_URL');
    if (cdnBaseUrl) {
      return `${cdnBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    const endpoint = this.config.get<string>('AWS_ENDPOINT');
    if (endpoint) {
      return `${endpoint.replace(/\/$/, '')}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
  }

  private buildLocalUrl(key: string): string {
    const apiBaseUrl = this.config.get<string>('API_BASE_URL', 'http://localhost:4000/api/v1');
    return `${apiBaseUrl.replace(/\/$/, '')}/uploads/local-file/${key}`;
  }
}