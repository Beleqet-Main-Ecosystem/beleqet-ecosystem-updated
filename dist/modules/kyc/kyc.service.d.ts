import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { KycProvider } from './providers/kyc-provider.interface';
import { KycDocumentType } from '@prisma/client';
import { KycUploadFile } from './kyc.controller';
export declare class KycService {
    private readonly prisma;
    private readonly uploadsService;
    private readonly kycProvider;
    private readonly logger;
    private readonly autoApproveThreshold;
    private readonly autoRejectThreshold;
    constructor(prisma: PrismaService, uploadsService: UploadsService, kycProvider: KycProvider);
    submitVerification(userId: string, documentType: KycDocumentType, documentFile: KycUploadFile | null | undefined, faceScanFile: KycUploadFile | null | undefined): Promise<{
        status: import(".prisma/client").$Enums.KycStatus;
        matchScore: number | null;
        livenessPassed: boolean | null;
        rejectionReason: string | null;
        verifiedAt: Date | null;
    }>;
    getVerificationStatus(userId: string): Promise<{
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
    getPendingVerifications(): Promise<({
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
    approveVerification(id: string, adminId: string): Promise<{
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
    rejectVerification(id: string, adminId: string, reason: string): Promise<{
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
