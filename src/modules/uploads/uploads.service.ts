import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import * as path from 'path';

@Injectable()
export class UploadsService {
  private s3Client: S3Client;
  private bucket: string;
  private readonly logger = new Logger(UploadsService.name);

  constructor(private config: ConfigService) {
    this.bucket =
      this.config.get<string>('R2_BUCKET_NAME') ??
      this.config.get<string>('AWS_S3_BUCKET', 'beleqet-uploads');

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

  async generatePresignedUrl(filename: string, contentType: string, folder = 'misc') {
    if (!this.s3Client)
      throw new InternalServerErrorException('Cloud storage not configured on server');

    // Generate random secure filename to prevent overwrites
    const ext = path.extname(filename);
    const key = `${folder}/${uuidv4()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    // URL is valid for 15 minutes
    const presignedUrl = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });

    const publicBaseUrl = this.config.get<string>('R2_PUBLIC_BASE_URL');
    const endpoint = this.config.get<string>('AWS_ENDPOINT');
    // If using AWS natively without a custom endpoint, format the public URL correctly
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
