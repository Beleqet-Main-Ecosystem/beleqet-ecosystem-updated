import { Response } from 'express';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { MulterFile } from './interfaces/multer-file.interface';
import { UploadsService } from './uploads.service';
export { ALLOWED_MIME_TYPES, MAX_UPLOAD_FILE_SIZE_BYTES } from './uploads.constants';
export declare const UPLOAD_FILE_INTERCEPTOR_OPTIONS: {
    limits: {
        fileSize: number;
    };
    fileFilter: (_request: unknown, file: {
        mimetype: string;
    }, callback: (error: Error | null, acceptFile: boolean) => void) => void;
};
export declare class PresignedUrlDto {
    filename: string;
    contentType: string;
    fileSize: number;
    folder?: string;
}
export declare class UploadFileDto {
    hasConsentedToProcessing: string;
}
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
    getPresignedUrl(body: PresignedUrlDto, user: CurrentUserPayload): Promise<{
        presignedUrl: string;
        publicUrl: string;
        key: string;
        cacheControl: string;
    }>;
    uploadFile(file: MulterFile | undefined, body: UploadFileDto, user: CurrentUserPayload): Promise<{
        key: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        size: number;
        filename: string;
        mimeType: string;
        hasConsentedToProcessing: boolean;
        isDeleted: boolean;
        deletedAt: Date | null;
        uploadedById: string | null;
    } & {
        publicUrl: string;
        cacheControl: string;
        contentType: string;
        optimized: boolean;
    }>;
    uploadFileAlias(file: MulterFile | undefined, body: UploadFileDto, user: CurrentUserPayload): Promise<{
        key: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        size: number;
        filename: string;
        mimeType: string;
        hasConsentedToProcessing: boolean;
        isDeleted: boolean;
        deletedAt: Date | null;
        uploadedById: string | null;
    } & {
        publicUrl: string;
        cacheControl: string;
        contentType: string;
        optimized: boolean;
    }>;
    getPresignedReadUrl(folder: string, filename: string): Promise<{
        url: string;
    }>;
    softDeleteFile(folder: string, filename: string, user: CurrentUserPayload): Promise<{
        key: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        size: number;
        filename: string;
        mimeType: string;
        hasConsentedToProcessing: boolean;
        isDeleted: boolean;
        deletedAt: Date | null;
        uploadedById: string | null;
    }>;
    getMyFiles(user: CurrentUserPayload): Promise<{
        key: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        size: number;
        filename: string;
        mimeType: string;
        hasConsentedToProcessing: boolean;
        isDeleted: boolean;
        deletedAt: Date | null;
        uploadedById: string | null;
    }[]>;
    serveLocalFile(folder: string, filename: string, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    private resolveLocalContentType;
}
