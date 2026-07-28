import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from './encryption.service';
import { BackupCodeService } from './backup-code.service';
import Redis from 'ioredis';
export declare class TwoFactorService {
    private readonly redis;
    private readonly prisma;
    private readonly jwt;
    private readonly config;
    private readonly encryption;
    private readonly backupCode;
    private readonly logger;
    private readonly issuer;
    private readonly tempSecret;
    constructor(redis: Redis, prisma: PrismaService, jwt: JwtService, config: ConfigService, encryption: EncryptionService, backupCode: BackupCodeService);
    private logAudit;
    private checkReplay;
    startEnrollment(userId: string): Promise<{
        provisioningUri: string;
        enrollmentToken: string;
        secret: string;
    }>;
    confirmEnrollment(userId: string, enrollmentToken: string, code: string): Promise<{
        success: boolean;
        backupCodes: string[];
    }>;
    verifyLogin(userId: string, code: string): Promise<boolean>;
    verifyStepUp(userId: string, code: string, action?: string, resourceId?: string): Promise<string>;
    verifyBackupCode(userId: string, code: string): Promise<number>;
    regenerateBackupCodes(userId: string): Promise<string[]>;
    disable(userId: string): Promise<void>;
    generateTempToken(userId: string): Promise<{
        tempToken: string;
        factorId: string;
    }>;
    cleanupExpiredEnrollments(): Promise<number>;
}
