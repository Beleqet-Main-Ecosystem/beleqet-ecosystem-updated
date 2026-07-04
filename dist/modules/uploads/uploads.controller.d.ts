import { UploadsService } from './uploads.service';
export declare class PresignedUrlDto {
    filename: string;
    contentType: string;
    folder?: string;
}
export declare class UploadsController {
    private readonly uploadsService;
    constructor(uploadsService: UploadsService);
    getPresignedUrl(body: PresignedUrlDto): Promise<{
        presignedUrl: string;
        publicUrl: string;
        key: string;
    }>;
    uploadFile(file: any): Promise<{
        publicUrl: string;
        key: string;
    }>;
}
