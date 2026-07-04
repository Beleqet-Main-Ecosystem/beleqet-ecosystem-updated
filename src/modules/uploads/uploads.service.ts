import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import sharp from 'sharp';
import { minify as minifyJs } from 'terser';
import CleanCSS from 'clean-css';
import { gzipSync } from 'zlib';
import { I18nService } from 'nestjs-i18n';

export interface UploadableFile {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
}

interface OptimizedAsset {
  buffer: Buffer;
  contentType: string;
  extension: string;
  contentEncoding?: 'gzip';
  optimized: boolean;
}

interface TranslationShape {
  messages: {
    uploads: {
      presignedUrlCreated: string;
      assetUploaded: string;
    };
  };
}

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private readonly logger = new Logger(UploadsService.name);
  private readonly immutableCacheControl: string;

  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService<TranslationShape>,
  ) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
    this.immutableCacheControl = this.config.get<string>(
      'CDN_CACHE_CONTROL',
      'public, max-age=31536000, immutable',
    );

    // Support AWS S3, Cloudflare R2, or DigitalOcean Spaces
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
      this.logger.warn('AWS credentials not found in .env. Uploads will fail.');
    }
  }

  /**
   * Creates a secure upload URL for direct browser-to-storage uploads.
   * Returns a CDN-facing URL for globally low-latency delivery.
   */
  async generatePresignedUrl(
    filename: string,
    contentType: string,
    folder = 'misc',
    language = 'en',
  ) {
    if (!this.s3Client)
      throw new InternalServerErrorException('Cloud storage not configured on server');

    // Generate random secure filename to prevent overwrites
    const ext = path.extname(filename);
    const key = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      CacheControl: this.immutableCacheControl,
    });

    // URL is valid for 15 minutes
    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    return {
      message: this.i18n.translate('messages.uploads.presignedUrlCreated', { lang: language }),
      presignedUrl,
      publicUrl: this.buildPublicUrl(key),
      key,
      cacheControl: this.immutableCacheControl,
    };
  }

  /**
   * Uploads a file through the API, applying optimization and compression
   * before persisting it to cloud object storage.
   */
  async uploadFile(file: UploadableFile, folder = 'misc', language = 'en') {
    if (!this.s3Client)
      throw new InternalServerErrorException('Cloud storage not configured on server');

    const optimizedAsset = await this.optimizeAsset(file);
    const key = `${folder}/${uuidv4()}${optimizedAsset.extension}`;

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
      message: this.i18n.translate('messages.uploads.assetUploaded', { lang: language }),
      publicUrl: this.buildPublicUrl(key),
      key,
      cacheControl: this.immutableCacheControl,
      contentType: optimizedAsset.contentType,
      contentEncoding: optimizedAsset.contentEncoding,
      optimized: optimizedAsset.optimized,
    };
  }

  /**
   * Builds the final public URL using a CDN base URL when configured.
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
   * Applies content-aware optimization:
   * - Images are converted to WebP
   * - CSS/JS/HTML/SVG/JSON are minified
   * - Text assets are gzipped when beneficial
   */
  private async optimizeAsset(file: UploadableFile): Promise<OptimizedAsset> {
    if (this.isImageMimeType(file.mimetype)) {
      const webpBuffer = await sharp(file.buffer).webp({ quality: 80 }).toBuffer();
      return {
        buffer: webpBuffer,
        contentType: 'image/webp',
        extension: '.webp',
        optimized: true,
      };
    }

    if (this.isTextMinifiableMimeType(file.mimetype)) {
      const minifiedBuffer = await this.minifyTextBuffer(file.buffer, file.mimetype);
      const gzipped = this.gzipIfBeneficial(minifiedBuffer);
      return {
        buffer: gzipped.buffer,
        contentType: file.mimetype,
        extension: path.extname(file.originalname),
        contentEncoding: gzipped.contentEncoding,
        optimized: minifiedBuffer.length !== file.buffer.length || !!gzipped.contentEncoding,
      };
    }

    return {
      buffer: file.buffer,
      contentType: file.mimetype,
      extension: path.extname(file.originalname),
      optimized: false,
    };
  }

  /**
   * Checks if an asset is an image MIME type eligible for WebP conversion.
   */
  private isImageMimeType(mimeType: string): boolean {
    return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
  }

  /**
   * Checks if a MIME type benefits from text minification.
   */
  private isTextMinifiableMimeType(mimeType: string): boolean {
    const minifiableTypes = new Set([
      'application/javascript',
      'text/javascript',
      'text/css',
      'text/html',
      'application/json',
      'image/svg+xml',
      'text/plain',
      'application/xml',
      'text/xml',
    ]);
    return minifiableTypes.has(mimeType);
  }

  /**
   * Minifies text-based files according to MIME type.
   */
  private async minifyTextBuffer(buffer: Buffer, mimeType: string): Promise<Buffer> {
    const content = buffer.toString('utf-8');

    if (mimeType === 'application/javascript' || mimeType === 'text/javascript') {
      try {
        const result = await minifyJs(content, {
          compress: true,
          mangle: true,
        });
        if (result.code) {
          return Buffer.from(result.code, 'utf-8');
        }
      } catch (error) {
        this.logger.warn(`JavaScript minification skipped: ${(error as Error).message}`);
      }
      return buffer;
    }

    if (mimeType === 'text/css') {
      const result = new CleanCSS({ level: 2 }).minify(content);
      if (result.styles) {
        return Buffer.from(result.styles, 'utf-8');
      }
      return buffer;
    }

    if (mimeType === 'application/json') {
      try {
        return Buffer.from(JSON.stringify(JSON.parse(content)), 'utf-8');
      } catch {
        return buffer;
      }
    }

    const collapsed = content
      .replace(/>\s+</g, '><')
      .replace(/\s{2,}/g, ' ')
      .trim();
    return Buffer.from(collapsed, 'utf-8');
  }

  /**
   * Gzips text content when payload is large enough and compression is effective.
   */
  private gzipIfBeneficial(buffer: Buffer): { buffer: Buffer; contentEncoding?: 'gzip' } {
    if (buffer.length < 1_024) {
      return { buffer };
    }

    const gzipped = gzipSync(buffer, { level: 9 });
    if (gzipped.length < buffer.length) {
      return { buffer: gzipped, contentEncoding: 'gzip' };
    }

    return { buffer };
  }
}
