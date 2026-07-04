import { ConfigService } from '@nestjs/config';
export declare class UploadsService {
    private config;
    private s3Client;
    private bucket;
    private readonly logger;
    constructor(config: ConfigService);
    generatePresignedUrl(filename: string, contentType: string, folder?: string): Promise<{
        presignedUrl: string;
        publicUrl: string;
        key: string;
    }>;
    uploadFile(file: any, folder?: string): Promise<{
        publicUrl: string;
        key: string;
    }>;
}
