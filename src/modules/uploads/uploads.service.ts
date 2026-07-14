import { Injectable, InternalServerErrorException, Logger, BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PrismaService } from '../../prisma/prisma.service';
import { StoredFile } from '@prisma/client';
import { MulterFile } from './interfaces/multer-file.interface';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class UploadsService {
  private s3Client: S3Client | null = null;
  private bucket: string;
  private useLocalFallback = false;
  private localStoreDir: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');
    this.localStoreDir = path.join(process.cwd(), 'temp-storage');

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
      if (!fs.existsSync(this.localStoreDir)) {
        fs.mkdirSync(this.localStoreDir, { recursive: true });
      }
    }
  }

  isLocalFallbackActive(): boolean {
    return this.useLocalFallback;
  }

  getLocalStoreDir(): string {
    return this.localStoreDir;
  }

  async generatePresignedUrl(filename: string, contentType: string, folder = 'misc', userId?: string) {
    const ext = path.extname(filename);
    const key = `${folder}/${uuidv4()}${ext}`;

    let presignedUrl = '';
    if (this.useLocalFallback) {
      presignedUrl = `http://localhost:4000/api/v1/uploads/local-file/${key}`;
    } else {
      if (!this.s3Client) throw new InternalServerErrorException('Cloud storage client not initialized');
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
      });
      presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    }

    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    const endpoint = this.config.get<string>('AWS_ENDPOINT');
    let publicUrl = '';
    if (this.useLocalFallback) {
      publicUrl = `http://localhost:4000/api/v1/uploads/local-file/${key}`;
    } else if (publicBaseUrl) {
      publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${key}`;
    } else if (endpoint) {
      publicUrl = `${endpoint}/${this.bucket}/${key}`;
    } else {
      publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${key}`;
    }

    // Save database record tracking
    await this.prisma.storedFile.create({
      data: {
        key,
        filename,
        mimeType: contentType,
        size: 0, // Client will upload payload later
        hasConsentedToProcessing: true,
        uploadedById: userId || null,
      },
    });

    return { presignedUrl, publicUrl, key };
  }

  async uploadFile(
    file: MulterFile,
    folderOrConsent: string | boolean = 'misc',
    userId?: string,
  ): Promise<StoredFile & { publicUrl: string }> {
    let hasConsentedToProcessing = true;
    let folder = 'misc';

    if (typeof folderOrConsent === 'boolean') {
      hasConsentedToProcessing = folderOrConsent;
      const allowedImages = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      const isImage = allowedImages.includes(file.mimetype);
      folder = isImage ? 'images' : 'documents';
    } else {
      folder = folderOrConsent;
    }

    if (!hasConsentedToProcessing) {
      throw new BadRequestException('GDPR data processing consent is mandatory to upload files.');
    }

    if (!file || !file.originalname || !file.buffer) {
      throw new BadRequestException('Invalid file payload.');
    }

    const sizeInBytes = file.size || file.buffer.length;
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
        if (!this.s3Client) throw new InternalServerErrorException('Cloud storage client not initialized');
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: fileKey,
          Body: file.buffer,
          ContentType: mimeType,
        });
        await this.s3Client.send(command);
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

      // Compute publicUrl
      const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
      const endpoint = this.config.get<string>('AWS_ENDPOINT');
      let publicUrl = '';
      if (this.useLocalFallback) {
        publicUrl = `http://localhost:4000/api/v1/uploads/local-file/${fileKey}`;
      } else if (publicBaseUrl) {
        publicUrl = `${publicBaseUrl.replace(/\/$/, '')}/${fileKey}`;
      } else if (endpoint) {
        publicUrl = `${endpoint}/${this.bucket}/${fileKey}`;
      } else {
        publicUrl = `https://${this.bucket}.s3.${this.config.get('AWS_REGION', 'us-east-1')}.amazonaws.com/${fileKey}`;
      }

      return {
        ...storedFile,
        publicUrl,
      };
    } catch (error) {
      this.logger.error(`Upload error details: ${(error as Error).message}`, (error as Error).stack);
      throw new InternalServerErrorException('Failed to process and store the file.');
    }
  }

  async getPresignedReadUrl(key: string): Promise<string> {
    const record = await this.prisma.storedFile.findUnique({
      where: { key },
    });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The requested file does not exist or has been deleted.');
    }

    try {
      if (this.useLocalFallback) {
        return `http://localhost:4000/api/v1/uploads/local-file/${record.key}`;
      }

      if (!this.s3Client) throw new InternalServerErrorException('Cloud storage client not initialized');
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: record.key,
      });

      const url = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
      return url;
    } catch (error) {
      this.logger.error(`Error generating presigned read URL: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to retrieve secure file URL.');
    }
  }

  async softDeleteFile(key: string, userId: string): Promise<StoredFile> {
    const record = await this.prisma.storedFile.findUnique({
      where: { key },
    });

    if (!record || record.isDeleted) {
      throw new NotFoundException('The file does not exist or has already been deleted.');
    }

    if (record.uploadedById !== userId) {
      throw new ForbiddenException('You do not have permission to delete this file.');
    }

    try {
      if (this.useLocalFallback) {
        const localPath = path.join(this.localStoreDir, record.key);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
        }
      } else {
        if (!this.s3Client) throw new InternalServerErrorException('Cloud storage client not initialized');
        const command = new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: record.key,
        });
        await this.s3Client.send(command);
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
      this.logger.error(`Error during file soft-deletion: ${(error as Error).message}`);
      throw new InternalServerErrorException('Failed to delete file.');
    }
  }

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
