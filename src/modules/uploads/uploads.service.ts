import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Readable } from 'stream';
import { I18nService } from 'nestjs-i18n';

/**
 * Response returned when generating a temporary upload URL.
 */
export interface UploadUrlResponse {
  /**
   * Temporary URL used by the client to upload a file.
   *
   * This URL expires after a limited time and can only be used
   * for uploading the specific object it was generated for.
   */
  uploadUrl: string;

  /**
   * Public URL of the uploaded object.
   *
   * Depending on the configured storage provider this may point
   * to Cloudflare R2, AWS S3 or another S3-compatible endpoint.
   */
  publicUrl: string;

  /**
   * Unique object key stored inside the bucket.
   */
  key: string;
}

/**
 * Response returned after uploading a file from the backend.
 */
export interface UploadFileResponse {
  /**
   * Public URL of the uploaded object.
   */
  publicUrl: string;

  /**
   * Object key stored inside the bucket.
   */
  key: string;
}
/**
 * Represents a file that can be uploaded to cloud storage.
 *
 * This interface intentionally contains only the properties required by
 * the UploadsService, allowing the service to remain independent of
 * Express, Multer, or any other HTTP framework.
 *
 * Implementations may wrap files originating from:
 *
 * - Express + Multer
 * - Fastify
 * - GraphQL multipart uploads
 * - Background jobs
 * - External storage providers
 */
export interface UploadedFile {
  /**
   * Original filename supplied by the client.
   *
   * Used to preserve the original file extension when generating
   * a unique object key.
   */
  originalname: string;

  /**
   * MIME type describing the uploaded file.
   *
   * Examples:
   * - image/jpeg
   * - image/png
   * -and so on...
   */
  mimetype: string;

  /**
   * Raw binary contents of the uploaded file.
   *
   * This buffer is transmitted directly to the configured
   * cloud storage provider.
   */
  buffer: Buffer;
}
/**
 * Service responsible for secure object storage operations.
 *
 * Supports:
 * - AWS S3
 * - Cloudflare R2
 * - DigitalOcean Spaces
 * - Any S3-compatible object storage provider
 *
 * Features:
 * - Generate temporary upload URLs
 * - Upload files from the backend
 * - Download private files for AI processing
 * - Generate unique object names
 *
 * Sensitive files such as KYC documents remain inside private
 * cloud storage and are only retrieved by trusted backend
 * services.
 */

@Injectable()
export class UploadsService {
  private readonly logger = new Logger(UploadsService.name);

  private readonly bucket: string;

  private s3Client!: S3Client;

  /**
   * Creates a new UploadsService.
   *
   * Reads cloud storage configuration from environment variables
   * and initializes an S3-compatible client.
   *
   * Supported providers include:
   *
   * - AWS S3
   * - Cloudflare R2
   * - DigitalOcean Spaces
   *
   * If credentials are missing the service still starts, but
   * upload operations will throw an exception.
   *
   * @param config Application configuration service.
   */
  constructor(
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');

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
        credentials: {
          accessKeyId,
          secretAccessKey,
        },
      });
    } else {
      this.logger.warn(
        'Cloud storage credentials are missing. Upload operations will be unavailable.',
      );
    }
  }

  /**
   * Generates a unique object key for a file.
   *
   * A UUID is used instead of the original filename to:
   *
   * - Prevent filename collisions.
   * - Hide original filenames.
   * - Produce deterministic storage paths.
   *
   * Example:
   *
   * passport.jpg
   *
   * becomes
   *
   * kyc/9d88b931-53e9-4aab-b89f.jpg
   *
   * @param filename Original filename.
   * @param folder Destination folder.
   *
   * @returns Generated object key.
   */
  private generateObjectKey(filename: string, folder: string): string {
    const extension = path.extname(filename);

    return `${folder}/${uuidv4()}${extension}`;
  }

  /**
   * Builds the public URL for a stored object.
   *
   * The URL is generated using one of the following strategies:
   *
   * 1. R2 public domain
   * 2. Custom endpoint
   * 3. Default AWS S3 URL
   *
   * @param key Object key.
   *
   * @returns Public URL.
   */
  private buildPublicUrl(key: string): string {
    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');

    const endpoint = this.config.get<string>('AWS_ENDPOINT');

    if (publicBaseUrl) {
      return `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    }

    if (endpoint) {
      return `${endpoint}/${this.bucket}/${key}`;
    }

    return `https://${this.bucket}.s3.${this.config.get(
      'AWS_REGION',
      'us-east-1',
    )}.amazonaws.com/${key}`;
  }
  /**
   * Downloads a private object from cloud storage and returns its contents
   * as a Buffer.
   *
   * This method is intended for trusted backend operations only.
   * Typical use cases include:
   *
   * - OCR document extraction
   * - Face verification
   * - Liveness detection
   * - AI-powered KYC validation
   * - Virus scanning
   *
   * The object is retrieved using authenticated server credentials and is
   * never exposed through a public URL.
   *
   * @param key Unique object key stored inside the bucket.
   *
   * @returns Promise resolving to the complete file as a Buffer.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage is unavailable or the object cannot be
   * downloaded.
   */
  async getFileBuffer(key: string): Promise<Buffer> {
    if (!this.s3Client) {
      throw new InternalServerErrorException('Cloud storage not configured on server');
    }

    try {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);

      if (!response.Body) {
        throw new InternalServerErrorException(await this.i18n.translate('uploads.empty_file'));
      }

      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return await new Promise<Buffer>((resolve, reject) => {
        stream.on('data', (chunk) => {
          chunks.push(Buffer.from(chunk));
        });

        stream.on('error', (error) => {
          reject(new InternalServerErrorException(this.i18n.translate('uploads.stream_failed')));
        });

        stream.on('end', () => {
          resolve(Buffer.concat(chunks));
        });
      });
    } catch (error) {
      this.logger.error(
        `Failed to download object "${key}"`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        await this.i18n.translate('uploads.file_retrieval_failed'),
      );
    }
  }

  /**
   * Generates a temporary upload URL that allows a client to upload a file
   * directly to cloud storage.
   *
   * Instead of sending the file through the backend, the frontend uploads it
   * directly to the configured S3-compatible storage provider.
   *
   * Benefits:
   *
   * - Reduces backend bandwidth usage.
   * - Improves scalability.
   * - Supports large file uploads.
   * - Keeps sensitive files inside private object storage.
   *
   * The generated upload URL is valid for 15 minutes.
   *
   * @param filename Original filename supplied by the client.
   * @param contentType MIME type of the uploaded file.
   * @param folder Destination folder inside the storage bucket.
   *
   * @returns Temporary upload URL, public URL and generated object key.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage is unavailable.
   */
  async generateUploadUrl(
    filename: string,
    contentType: string,
    folder = 'misc',
  ): Promise<UploadUrlResponse> {
    if (!this.s3Client) {
      throw new InternalServerErrorException(
        await this.i18n.translate('uploads.storage_not_configured'),
      );
    }

    const key = this.generateObjectKey(filename, folder);

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.s3Client, command, {
      expiresIn: 60 * 15,
    });

    return {
      uploadUrl,
      publicUrl: this.buildPublicUrl(key),
      key,
    };
  }
  /**
   * Uploads a file directly from the backend to private cloud storage.
   *
   * Unlike {@link generateUploadUrl}, this method transfers the file through
   * the backend server before uploading it to the configured S3-compatible
   * storage provider.
   *
   * This method is best suited for:
   *
   * - Internal administrative uploads
   * - Scheduled background jobs
   * - Server-to-server integrations
   * - Automated import processes
   *
   * Browser-based uploads should generally use {@link generateUploadUrl}
   * to avoid routing large files through the backend.
   *
   * A UUID-based filename is generated automatically to:
   *
   * - Prevent filename collisions.
   * - Hide original filenames.
   * - Produce predictable storage paths.
   *
   * @param file Uploaded Multer file.
   * @param folder Destination folder inside the storage bucket.
   *
   * @returns Information about the uploaded object.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage is unavailable or the upload fails.
   */
  async uploadFile(file: UploadedFile, folder = 'misc'): Promise<UploadFileResponse> {
    if (!this.s3Client) {
      throw new InternalServerErrorException(
        await this.i18n.translate('uploads.storage_not_configured'),
      );
    }

    const key = this.generateObjectKey(file.originalname, folder);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await this.s3Client.send(command);

      return {
        publicUrl: this.buildPublicUrl(key),
        key,
      };
    } catch (error) {
      this.logger.error(
        `Failed to upload object "${key}"`,
        error instanceof Error ? error.stack : undefined,
      );

      throw new InternalServerErrorException(
        await this.i18n.translate('uploads.storage_not_configured'),
      );
    }
  }
  /**
   * Generates a temporary download URL for a private object.
   *
   * Allows authorized users to retrieve private files without
   * exposing the storage bucket publicly.
   *
   * @param key Private object storage key.
   *
   * @returns Temporary signed download URL.
   */
  async generateDownloadUrl(key: string): Promise<string> {
    if (!this.s3Client) {
      throw new InternalServerErrorException(
        await this.i18n.translate('uploads.storage_not_configured'),
      );
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, {
      expiresIn: 900,
    });
  }
}
