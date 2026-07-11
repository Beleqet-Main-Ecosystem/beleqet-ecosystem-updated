import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'; // Added GetObjectCommand
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import { Readable } from 'stream'; // Added for stream-to-buffer casting
/**
 * Service responsible for secure object storage operations.
 *
 * Supports:
 * - AWS S3
 * - Cloudflare R2
 * - DigitalOcean Spaces (S3-compatible)
 *
 * Provides utilities for:
 * - Generating presigned upload URLs.
 * - Uploading files from the backend.
 * - Retrieving private files for internal processing.
 *
 * This service is designed for GDPR-compliant private storage workflows,
 * ensuring that sensitive assets such as KYC identity documents remain
 * inaccessible to the public and are retrieved only by trusted backend
 * services.
 */
@Injectable()
export class UploadsService {
  private s3Client!: S3Client;
  private bucket: string;
  private readonly logger = new Logger(UploadsService.name);
  /**
   * Creates a new UploadsService instance.
   *
   * Initializes an S3-compatible client using configuration values from the
   * application environment. Supports AWS S3, Cloudflare R2, and other
   * compatible object storage providers.
   *
   * If storage credentials are not configured, upload operations will be
   * unavailable and a warning is logged during application startup.
   *
   * @param config Application configuration service.
   */
  constructor(private config: ConfigService) {
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
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.logger.warn('AWS credentials not found in .env. Uploads will fail.');
    }
  }

  /**
   * Downloads a private object from cloud storage and returns its contents
   * as a Buffer.
   *
   * This method is intended for internal processing only, such as:
   * - OCR document extraction
   * - Face matching
   * - Liveness detection
   * - AI-powered KYC verification
   *
   * The file is never exposed through a public URL. Instead, it is securely
   * retrieved using authenticated backend credentials.
   *
   * @param key Object key stored in the S3-compatible bucket.
   *
   * @returns A Promise resolving to the complete file as a Buffer.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage is unavailable or the object cannot be retrieved.
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
        throw new InternalServerErrorException(
          `Empty file body returned for cloud object key: ${key}`,
        );
      }

      // Safe stream-to-buffer implementation compatible with AWS SDK v3 Node streams
      const stream = response.Body as Readable;
      const chunks: Buffer[] = [];

      return new Promise((resolve, reject) => {
        stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        stream.on('error', (err) =>
          reject(
            new InternalServerErrorException(`Stream failure downloading file: ${err.message}`),
          ),
        );
        stream.on('end', () => resolve(Buffer.concat(chunks)));
      });
    } catch (error: any) {
      this.logger.error(
        `Failed to pull file from cloud storage key ${key}: ${error.message}`,
        error.stack,
      );

      throw new InternalServerErrorException(
        'Could not retrieve verification asset from private storage',
      );
    }
  }
  /**
   * Generates a temporary presigned upload URL for a private storage bucket.
   *
   * Clients upload files directly to cloud storage without passing file data
   * through the backend server. This improves scalability while ensuring
   * sensitive files remain in private object storage.
   *
   * The generated URL expires after 15 minutes.
   *
   * @param filename Original client filename.
   * @param contentType MIME type of the uploaded file.
   * @param folder Destination folder within the storage bucket.
   *
   * @returns Upload URL, public object URL, and generated object key.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage has not been configured.
   */
  async generatePresignedUrl(filename: string, contentType: string, folder = 'misc') {
    if (!this.s3Client)
      throw new InternalServerErrorException('Cloud storage not configured on server');

    const ext = path.extname(filename);
    const key = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    const endpoint = this.config.get<string>('AWS_ENDPOINT');
    let publicUrl = '';
    if (publicBaseUrl) {
      publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    } else if (endpoint) {
      publicUrl = `${endpoint}/${this.bucket}/${key}`;
    } else {
      publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
    }

    return { presignedUrl, publicUrl, key };
  }
  /**
   * Uploads a file directly from the backend to private cloud storage.
   *
   * This method is primarily intended for internal server-side uploads.
   * For browser-based uploads, prefer {@link generatePresignedUrl}, which
   * allows clients to upload directly to object storage using temporary
   * presigned URLs.
   *
   * Uploaded files receive a randomized UUID filename to prevent collisions
   * and protect the original filename.
   *
   * @param file Uploaded file object provided by Multer.
   * @param folder Destination folder inside the storage bucket.
   *
   * @returns The stored object's public URL (if available) and storage key.
   *
   * @throws InternalServerErrorException
   * Thrown when cloud storage is not configured.
   */
  async uploadFile(file: any, folder = 'misc') {
    if (!this.s3Client)
      throw new InternalServerErrorException('Cloud storage not configured on server');

    const ext = path.extname(file.originalname);
    const key = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    });

    await this.s3Client.send(command);

    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    const endpoint = this.config.get<string>('AWS_ENDPOINT');
    let publicUrl = '';
    if (publicBaseUrl) {
      publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    } else if (endpoint) {
      publicUrl = `${endpoint}/${this.bucket}/${key}`;
    } else {
      publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
    }

    return { publicUrl, key };
  }
}
