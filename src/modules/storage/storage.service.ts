import { Injectable, InternalServerErrorException, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service';
import { StoredFile } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Service for cloud object storage operations. Integrates AWS S3 client
 * with a fallback option for local file-system storage during development,
 * enforces file validations, and strictly implements GDPR and data compliance policies.
 */
@Injectable()
export class StorageService {
  private readonly s3Client: S3Client | null = null;
  private readonly bucket: string;
  private readonly useLocalFallback: boolean = false;
  private readonly localStoreDir: string;
  private readonly logger = new Logger(StorageService.name);

  /**
   * Initializes the StorageService with AWS configurations or local storage fallback settings.
   *
   * @param config - NestJS ConfigService for fetching environment variables.
   * @param prisma - PrismaService for executing database operations.
   * @security GDPR/Security considerations: Validates if secure access credentials are
   *           provided, logging warnings in non-production environments when keys are missing.
   */
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.bucket = this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
    this.localStoreDir = path.join(process.cwd(), 'temp-storage');

    const region = this.config.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.config.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.config.get<string>('AWS_SECRET_ACCESS_KEY');
    const endpoint = this.config.get<string>('AWS_ENDPOINT');

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
      this.logger.log('S3 Storage client initialized successfully.');
    } else {
      this.useLocalFallback = true;
      this.logger.warn(
        `AWS S3 credentials are missing or default. Falling back to local disk storage at: ${this.localStoreDir}`,
      );
      if (!fs.existsSync(this.localStoreDir)) {
        fs.mkdirSync(this.localStoreDir, { recursive: true });
      }
    }
  }

  /**
   * Getter to determine if the local filesystem is used as storage fallback.
   *
   * @returns True if fallback is active, otherwise false.
   * @security None. Simple state checker.
   */
  isLocalFallbackActive(): boolean {
    return this.useLocalFallback;
  }

  /**
   * Getter for the local storage directory path.
   *
   * @returns Absolute folder path string.
   * @security None.
   */
  getLocalStoreDir(): string {
    return this.localStoreDir;
  }

  /**
   * Validates, processes, and uploads a file to secure S3 storage or local fallback directory.
   * Enforces file size limits (5MB for images, 10MB for documents) and strict MIME-types.
   *
   * @param file - Express Multer file object containing buffer and original name.
   * @param hasConsentedToProcessing - Boolean indicating GDPR consent.
   * @param userId - Optional ID of the user uploading the file.
   * @returns The generated database record representing the stored file metadata.
   * @throws BadRequestException if the file exceeds size limits, has an unsupported MIME-type,
   *          or if GDPR consent was not granted.
   * @throws InternalServerErrorException if the upload fails.
   * @security GDPR Compliance: Block uploads if consent flag is false.
   *           Obfuscates S3 storage paths by using UUID keys to prevent naming exposure (PII).
   */
  async uploadFile(
    file: Express.Multer.File,
    hasConsentedToProcessing: boolean,
    userId?: string,
  ): Promise<StoredFile> {
    if (!hasConsentedToProcessing) {
      throw new BadRequestException('GDPR data processing consent is mandatory to upload files.');
    }

    if (!file || !file.originalname || !file.buffer) {
      throw new BadRequestException('Invalid file payload.');
    }

    const sizeInBytes = file.size;
    const mimeType = file.mimetype;

    const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const allowedDocs = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const isImage = allowedImages.includes(mimeType);
    const isDoc = allowedDocs.includes(mimeType);

    if (!isImage && !isDoc) {
      throw new BadRequestException(`Unsupported file type: ${mimeType}`);
    }

    // Enforce size limits: 5MB for images, 10MB for documents
    const maxImageSize = 5 * 1024 * 1024;
    const maxDocSize = 10 * 1024 * 1024;

    if (isImage && sizeInBytes > maxImageSize) {
      throw new BadRequestException('Image size exceeds the maximum limit of 5MB.');
    }
    if (isDoc && sizeInBytes > maxDocSize) {
      throw new BadRequestException('Document size exceeds the maximum limit of 10MB.');
    }

    const ext = path.extname(file.originalname);
    const folder = isImage ? 'images' : 'documents';
    // Generate secure UUID filename key (completely masks PII from filenames in store)
    const fileKey = `${folder}/${uuidv4()}${ext}`;

    try {
      if (this.useLocalFallback) {
        const localPath = path.join(this.localStoreDir, fileKey);
        const folderPath = path.dirname(localPath);
        if (!fs.existsSync(folderPath)) {
          fs.mkdirSync(folderPath, { recursive: true });
        }
        fs.writeFileSync(localPath, file.buffer);
        this.logger.debug(`File written locally to: ${localPath}`);
      } else {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
          Body: file.buffer,
          ContentType: mimeType,
        });
        await this.s3Client!.send(command);
        this.logger.debug(`File uploaded to S3: ${fileKey}`);
      }

      // Save database record with consent details
      const storedFile = await this.prisma.storedFile.create({
        data: {
          key: fileKey,
          filename: file.originalname,
          mimeType: mimeType,
          size: sizeInBytes,
          hasConsentedToProcessing: true,
          uploadedById: userId || null,
        },
      });

      return storedFile;
    } catch (error) {
      this.logger.error(`Upload error details: ${(error as Error).message}`, (error as Error).stack);
      throw new InternalServerErrorException('Failed to process and store the file.');
    }
  }

  /**
   * Generates a temporary read presigned URL for secure access to the file.
   *
   * @param key - The unique S3 storage key of the file.
   * @returns Resolves with the secure, timed presigned URL string.
   * @throws NotFoundException if the file is not found in database or is marked as deleted.
   * @throws InternalServerErrorException if URL generation fails.
   * @security GDPR/Access Control: Ensures files marked as soft-deleted are blocked from access,
   *           preventing accidental recovery of deleted PII.
   */
  async getPresignedReadUrl(key: string): Promise<string> {
    const record = await this.prisma.storedFile.findUnique({
      where: { key },
    });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The requested file does not exist or has been deleted.');
    }

    try {
      if (this.useLocalFallback) {
        // Return a mock local URL for development sandbox testing
        return `http://localhost:4000/api/v1/storage/local-file/${record.key}`;
      }

      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: record.key,
      });

      // Expires in 15 minutes (900 seconds)
      const url = await getSignedUrl(this.s3Client!, command, { expiresIn: 900 });
      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned read URL: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve secure file URL.');
    }
  }

  /**
   * Performs a GDPR-compliant soft-delete on a stored file:
   * Sets the soft-delete database flag, masks name metadata, and physically deletes the S3/local file.
   *
   * @param key - The unique S3 storage key of the file to delete.
   * @returns Resolves with the updated, masked StoredFile database record.
   * @throws NotFoundException if the file does not exist or is already deleted.
   * @throws InternalServerErrorException if the deletion fails.
   * @security GDPR Deletion: Masks the database metadata (filenames) and permanently purges
   *           the underlying S3 bucket storage object to guarantee removal of user PII.
   */
  async softDeleteFile(key: string): Promise<StoredFile> {
    const record = await this.prisma.storedFile.findUnique({
      where: { key },
    });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The file does not exist or has already been deleted.');
    }

    try {
      // 1. Physically delete file from S3 bucket or local folder to purge PII
      if (this.useLocalFallback) {
        const localPath = path.join(this.localStoreDir, record.key);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } else {
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: record.key,
        });
        await this.s3Client!.send(command);
      }

      // 2. Perform database update: mask PII and flag isDeleted
      const updated = await this.prisma.storedFile.update({
        where: { key: record.key },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
          filename: 'DELETED_GDPR_COMPLIANCE_MASKED', // completely mask original filename
        },
      });

      this.logger.log(`GDPR Soft-delete completed for file key: ${record.key}`);
      return updated;
    } catch (error) {
      this.logger.error(`Error during file soft-deletion: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to delete file.');
    }
  }

  /**
   * Retrieves a list of active (non-deleted) stored files uploaded by a specific user.
   *
   * @param userId - The unique identifier of the uploading user.
   * @returns Resolves with an array of StoredFile database records.
   * @throws InternalServerErrorException if the database query fails.
   * @security None. Ownership/authentication checks are handled at the API gateway / controller layer.
   */
  async getMyFiles(userId: string): Promise<StoredFile[]> {
    try {
      return await this.prisma.storedFile.findMany({
        where: {
          uploadedById: userId,
          isDeleted: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    } catch (error) {
      this.logger.error(`Error retrieving user files: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve files list.');
    }
  }
}

