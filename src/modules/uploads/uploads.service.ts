import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import { I18nService } from 'nestjs-i18n';
import {
  ALLOWED_MIME_TYPES,
  AllowedMimeType,
  MAX_UPLOAD_FILE_SIZE_BYTES,
  MIME_TYPE_EXTENSIONS,
} from './uploads.constants';

export interface UploadableFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size?: number;
}

export type UserThemePreference = 'light' | 'dark' | 'system';

export interface UploadContext {
  language?: string;
  userThemePreference?: UserThemePreference;
}

interface OptimizedAsset {
  buffer: Buffer;
  contentType: string;
  extension: string;
  contentEncoding?: 'gzip';
  optimized: boolean;
}

interface UploadTranslationShape {
  messages: {
    uploads: {
      presignedUrlCreated: string;
      assetUploaded: string;
    };
  };
}

@Injectable()
export class UploadsService {
  private s3Client?: S3Client;
  private readonly bucket: string;
  private readonly logger = new Logger(UploadsService.name);
  private readonly immutableCacheControl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService<UploadTranslationShape>,
  ) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
    this.immutableCacheControl = this.config.get<string>(
      'CDN_CACHE_CONTROL',
      'public, max-age=31536000, immutable',
    );

    const endpoint =
      this.config.get<string>('AWS_ENDPOINT') ??
      (this.config.get<string>('R2_ACCOUNT_ID')
        ? `https://${this.config.get<string>('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`
        : undefined);
    const region = this.config.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId =
      this.config.get<string>('R2_ACCESS_KEY_ID') ?? this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey =
      this.config.get<string>('R2_SECRET_ACCESS_KEY') ??
      this.config.get<string>('AWS_SECRET_ACCESS_KEY');

    if (accessKeyId && secretAccessKey) {
      this.s3Client = new S3Client({
        region,
        ...(endpoint && { endpoint }),
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('Object storage credentials are not configured. Uploads will fail.');
    }
  }

  /**
   * Creates a short-lived direct upload URL and a CDN-facing delivery URL.
   */
  async generatePresignedUrl(
    filename: string,
    contentType: string,
    folder = 'misc',
    contextOrLanguage: UploadContext | string = 'en',
  ): Promise<{
    message: string;
    presignedUrl: string;
    publicUrl: string;
    key: string;
    cacheControl: string;
  }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Cloud storage not configured on server');
    }

    const context = this.normalizeUploadContext(contextOrLanguage);
    const targetFolder = this.resolveThemeAwareFolder(folder, context.userThemePreference);
    const extension = this.resolveSafeExtension(contentType);
    const key = `${targetFolder}/${uuidv4()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: this.immutableCacheControl,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    return {
      message: this.i18n.translate('messages.uploads.presignedUrlCreated', {
        lang: context.language,
      }),
      presignedUrl,
      publicUrl: this.buildPublicUrl(key),
      key,
      cacheControl: this.immutableCacheControl,
    };
  }

  /**
   * Optimizes allowed images and uploads files through API-controlled object storage.
   */
  async uploadFile(
    file: UploadableFile,
    folder = 'misc',
    contextOrLanguage: UploadContext | string = 'en',
  ): Promise<{
    message: string;
    publicUrl: string;
    key: string;
    cacheControl: string;
    contentType: string;
    contentEncoding?: 'gzip';
    optimized: boolean;
  }> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Cloud storage not configured on server');
    }

    this.assertUploadableFile(file);
    const context = this.normalizeUploadContext(contextOrLanguage);
    const targetFolder = this.resolveThemeAwareFolder(folder, context.userThemePreference);
    const optimizedAsset = await this.optimizeAsset(file);
    const key = `${targetFolder}/${uuidv4()}${optimizedAsset.extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: optimizedAsset.buffer,
      ContentType: optimizedAsset.contentType,
      CacheControl: this.immutableCacheControl,
      ContentEncoding: optimizedAsset.contentEncoding,
    });

    await this.s3Client.send(command);

    return {
      message: this.i18n.translate('messages.uploads.assetUploaded', { lang: context.language }),
      publicUrl: this.buildPublicUrl(key),
      key,
      cacheControl: this.immutableCacheControl,
      contentType: optimizedAsset.contentType,
      contentEncoding: optimizedAsset.contentEncoding,
      optimized: optimizedAsset.optimized,
    };
  }

  /**
   * Normalizes legacy language-only calls and typed upload context calls.
   */
  private normalizeUploadContext(
    contextOrLanguage: UploadContext | string,
  ): Required<UploadContext> {
    if (typeof contextOrLanguage === 'string') {
      return { language: contextOrLanguage || 'en', userThemePreference: 'system' };
    }

    return {
      language: contextOrLanguage.language || 'en',
      userThemePreference: contextOrLanguage.userThemePreference || 'system',
    };
  }

  /**
   * Routes theme-specific assets by user preference while leaving normal files unchanged.
   */
  private resolveThemeAwareFolder(
    folder: string,
    userThemePreference: UserThemePreference,
  ): string {
    const safeFolder = this.validateStorageFolder(folder);

    if (!safeFolder.startsWith('theme-assets') || userThemePreference === 'system') {
      return safeFolder;
    }

    return `${safeFolder}/${userThemePreference}`;
  }

  /**
   * Builds the public delivery URL, preferring CDN domains over raw storage URLs.
   */
  private buildPublicUrl(key: string): string {
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

  /**
   * Converts raster images to WebP and stores all other allowed files unchanged.
   */
  private async optimizeAsset(file: UploadableFile): Promise<OptimizedAsset> {
    if (this.isImageMimeType(file.mimetype)) {
      const webpBuffer = await this.convertImageToWebp(file.buffer);
      return {
        buffer: webpBuffer,
        contentType: 'image/webp',
        extension: '.webp',
        optimized: true,
      };
    }

    return {
      buffer: file.buffer,
      contentType: file.mimetype,
      extension: this.resolveSafeExtension(file.mimetype),
      optimized: false,
    };
  }

  /**
   * Determines whether a file should be converted to WebP.
   */
  private isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
  }

  /**
   * Verifies a multipart upload contains a usable file payload.
   */
  private assertUploadableFile(file?: UploadableFile): asserts file is UploadableFile {
    if (!file || !file.buffer || !file.mimetype || !file.originalname) {
      throw new BadRequestException('Uploaded file is required');
    }

    if (!this.isAllowedMimeType(file.mimetype)) {
      throw new BadRequestException(
        'Invalid file type. Executables and HTML files are not allowed.',
      );
    }

    const fileSize = file.size ?? file.buffer.length;
    if (fileSize > MAX_UPLOAD_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File size must not exceed ${MAX_UPLOAD_FILE_SIZE_BYTES} bytes.`,
      );
    }
  }

  /**
   * Converts uploaded raster images to WebP and returns a client-safe error for malformed images.
   */
  private async convertImageToWebp(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer).webp({ quality: 80 }).toBuffer();
    } catch {
      throw new BadRequestException('Uploaded image is invalid or corrupted');
    }
  }

  /**
   * Restricts object keys to owned, predictable prefixes inside the uploads namespace.
   */
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

  private isAllowedMimeType(mimeType: string): mimeType is AllowedMimeType {
    return ALLOWED_MIME_TYPES.includes(mimeType as AllowedMimeType);
  }

  private resolveSafeExtension(contentType: string): string {
    if (!this.isAllowedMimeType(contentType)) {
      throw new BadRequestException(
        'Invalid file type. Executables and HTML files are not allowed.',
      );
    }

    return MIME_TYPE_EXTENSIONS[contentType];
  }
}
