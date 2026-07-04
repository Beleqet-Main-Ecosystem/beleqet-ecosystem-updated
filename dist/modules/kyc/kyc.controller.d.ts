import { KycService } from './kyc.service';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { KycDocumentType } from '@prisma/client';
export interface KycUploadFile {
    buffer: Buffer;
    originalname: string;
    mimetype: string;
}
export declare class SubmitKycDto {
    documentType: KycDocumentType;
}
export declare class RejectKycDto {
    reason: string;
}
export declare class KycController {
    private readonly kycService;
    constructor(kycService: KycService);
    submitKyc(files: {
        document?: KycUploadFile[];
        faceScan?: KycUploadFile[];
    }, user: CurrentUserPayload, dto: SubmitKycDto): Promise<{
        status: import(".prisma/client").$Enums.KycStatus;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    }>;
    getStatus(user: CurrentUserPayload): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        documentType: import(".prisma/client").$Enums.KycDocumentType;
        documentUrl: string;
        faceScanUrl: string;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    }>;
    getPending(): Promise<({
        user: {
            email: string;
            firstName: string;
            lastName: string;
            id: string;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        documentType: import(".prisma/client").$Enums.KycDocumentType;
        documentUrl: string;
        faceScanUrl: string;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    })[]>;
    approve(id: string, admin: CurrentUserPayload): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        documentType: import(".prisma/client").$Enums.KycDocumentType;
        documentUrl: string;
        faceScanUrl: string;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    }>;
    reject(id: string, admin: CurrentUserPayload, dto: RejectKycDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.KycStatus;
        createdAt: Date;
        updatedAt: Date;
        userId: string;
        documentType: import(".prisma/client").$Enums.KycDocumentType;
        documentUrl: string;
        faceScanUrl: string;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    }>;
}
