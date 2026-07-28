import { ConfigService } from '@nestjs/config';
import { StoredFile } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MulterFile } from './interfaces/multer-file.interface';
export declare class UploadsService {
    private readonly config;
    private readonly prisma;
    private s3Client;
    private readonly bucket;
    private readonly localStoreDir;
    private readonly immutableCacheControl;
    private useLocalFallback;
    private readonly logger;
    constructor(config: ConfigService, prisma: PrismaService);
    isLocalFallbackActive(): boolean;
    getLocalStoreDir(): string;
    generatePresignedUrl(filename: string, contentType: string, folder?: string, userId?: string, fileSize?: number): Promise<{
        presignedUrl: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
    }>;
    uploadFile(file: MulterFile, folderOrConsent?: string | boolean, userId?: string): Promise<StoredFile & {
        publicUrl: string;
        cacheControl: string;
        contentType: string;
        optimized: boolean;
    }>;
    getPresignedReadUrl(key: string): Promise<string>;
    softDeleteFile(key: string, userId: string): Promise<StoredFile>;
    getMyFiles(userId: string): Promise<StoredFile[]>;
    resolveLocalFilePath(key: string): string;
    private resolveUploadTarget;
    private optimizeAsset;
    private assertUploadableFile;
    private assertFileSize;
    private assertAllowedMimeType;
    private isImageMimeType;
    private convertImageToWebp;
    private validateStorageFolder;
    private validateStorageKey;
    private resolveSafeExtension;
    private sanitizeFilename;
    private buildPublicUrl;
    private buildLocalUrl;
}
