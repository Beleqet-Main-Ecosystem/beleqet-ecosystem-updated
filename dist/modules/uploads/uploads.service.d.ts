import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
export interface UploadableFile {
    originalname: string;
    mimetype: string;
    buffer: Buffer;
    size: number;
}
interface TranslationShape {
    messages: {
        uploads: {
            presignedUrlCreated: string;
            assetUploaded: string;
        };
    };
}
export declare class UploadsService {
    private readonly config;
    private readonly i18n;
    private s3Client;
    private bucket;
    private readonly logger;
    private readonly immutableCacheControl;
    constructor(config: ConfigService, i18n: I18nService<TranslationShape>);
    generatePresignedUrl(filename: string, contentType: string, folder?: string, language?: string): Promise<{
        message: string;
        presignedUrl: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
    }>;
    uploadFile(file: UploadableFile, folder?: string, language?: string): Promise<{
        message: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
        contentType: string;
        contentEncoding: "gzip" | undefined;
        optimized: boolean;
    }>;
    private buildPublicUrl;
    private optimizeAsset;
    private isImageMimeType;
    private isTextMinifiableMimeType;
    private minifyTextBuffer;
    private gzipIfBeneficial;
}
export {};
