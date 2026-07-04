import { UploadableFile, UploadsService } from './uploads.service';
export declare class PresignedUrlDto {
    filename: string;
    contentType: string;
    folder?: string;
}
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
    getPresignedUrl(body: PresignedUrlDto, acceptLanguage?: string): Promise<{
        message: string;
        presignedUrl: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
    }>;
    uploadFile(file: UploadableFile, acceptLanguage?: string): Promise<{
        message: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
        contentType: string;
        contentEncoding: "gzip" | undefined;
        optimized: boolean;
    }>;
    private resolveLanguage;
}
