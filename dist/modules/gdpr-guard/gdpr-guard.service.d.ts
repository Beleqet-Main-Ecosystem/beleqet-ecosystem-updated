import { PrismaService } from '../../prisma/prisma.service';
export interface DataErasureAuditContext {
    reason: string;
    actorUserId: string;
}
export declare class GdprGuardService {
    private readonly prisma;
    private readonly algorithm;
    private readonly ivLength;
    private readonly secretKey;
    constructor(prisma: PrismaService);
    encryptPii(text: string): string;
    decryptPii(encryptedText: string): string;
    scrubGatewayResponsePii(value: unknown): unknown;
    executeDataErasure(userUuid: string, audit: DataErasureAuditContext): Promise<{
        success: boolean;
        scrubbedAt: string;
        referenceId: string;
    }>;
}
