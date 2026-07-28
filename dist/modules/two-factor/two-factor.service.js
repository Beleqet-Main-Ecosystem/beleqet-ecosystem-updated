"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var TwoFactorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwoFactorService = void 0;
const common_1 = require("@nestjs/common");
const jwt_1 = require("@nestjs/jwt");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const encryption_service_1 = require("./encryption.service");
const backup_code_service_1 = require("./backup-code.service");
const otplib_1 = require("otplib");
const redis_module_1 = require("../redis/redis.module");
const ioredis_1 = require("ioredis");
const ENROLLMENT_TOKEN_EXPIRY = 10 * 60;
const STEP_UP_TEMP_EXPIRY = 5 * 60;
const STEP_UP_VERIFIED_EXPIRY = 15 * 60;
const REPLAY_KEY_TTL_MS = 90_000;
const KEY_PREFIX = '2fa:used';
let TwoFactorService = TwoFactorService_1 = class TwoFactorService {
    constructor(redis, prisma, jwt, config, encryption, backupCode) {
        this.redis = redis;
        this.prisma = prisma;
        this.jwt = jwt;
        this.config = config;
        this.encryption = encryption;
        this.backupCode = backupCode;
        this.logger = new common_1.Logger(TwoFactorService_1.name);
        this.issuer = config.get('TOTP_ISSUER', 'Beleqet');
        const ts = config.get('TOTP_TEMP_SECRET');
        if (!ts) {
            throw new Error('TOTP_TEMP_SECRET is required. Set it in your environment variables.');
        }
        this.tempSecret = ts;
    }
    async logAudit(eventType, userId, reason, metadata) {
        try {
            await this.prisma.eventLog.create({
                data: {
                    eventType,
                    entityId: userId,
                    entityType: 'User',
                    payload: { reason, ...metadata },
                    processedBy: 'TwoFactorService',
                },
            });
        }
        catch (err) {
            this.logger.error(`Failed to write audit log: ${err.message}`);
        }
    }
    async checkReplay(userId, code) {
        const key = `${KEY_PREFIX}:${userId}:${code}`;
        const result = await this.redis.set(key, '1', 'PX', REPLAY_KEY_TTL_MS, 'NX');
        return result === 'OK';
    }
    async startEnrollment(userId) {
        const existing = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (existing?.enabled) {
            throw new common_1.ConflictException('Two-factor authentication is already enabled');
        }
        const secret = (0, otplib_1.generateSecret)();
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { email: true },
        });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        const encrypted = this.encryption.encrypt(secret);
        const enrollmentToken = this.jwt.sign({ sub: userId, purpose: '2fa_enrollment' }, { secret: this.tempSecret, expiresIn: ENROLLMENT_TOKEN_EXPIRY });
        await this.prisma.userTwoFactor.upsert({
            where: { userId },
            update: {
                secret: encrypted.ciphertext,
                encryptionKeyVersion: encrypted.keyVersion,
                enabled: false,
                enrollmentToken,
                enrollmentExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_EXPIRY * 1000),
            },
            create: {
                userId,
                secret: encrypted.ciphertext,
                encryptionKeyVersion: encrypted.keyVersion,
                enabled: false,
                enrollmentToken,
                enrollmentExpiresAt: new Date(Date.now() + ENROLLMENT_TOKEN_EXPIRY * 1000),
            },
        });
        const otpauth = (0, otplib_1.generateURI)({ issuer: this.issuer, label: user.email, secret });
        return {
            provisioningUri: otpauth,
            enrollmentToken,
            secret,
        };
    }
    async confirmEnrollment(userId, enrollmentToken, code) {
        let payload;
        try {
            payload = this.jwt.verify(enrollmentToken, { secret: this.tempSecret });
        }
        catch {
            await this.logAudit('2FA_ENROLL_FAILURE', userId, 'expired_token');
            throw new common_1.BadRequestException('Invalid or expired enrollment token');
        }
        if (payload.sub !== userId || payload.purpose !== '2fa_enrollment') {
            await this.logAudit('2FA_ENROLL_FAILURE', userId, 'invalid_token');
            throw new common_1.BadRequestException('Invalid enrollment token');
        }
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!record)
            throw new common_1.BadRequestException('No pending enrollment found');
        if (record.enabled)
            throw new common_1.ConflictException('Already enabled');
        const decryptedSecret = this.encryption.decrypt(record.secret);
        const verifyResult = await (0, otplib_1.verify)({ secret: decryptedSecret, token: code });
        if (!verifyResult.valid) {
            await this.logAudit('2FA_ENROLL_FAILURE', userId, 'invalid_code');
            throw new common_1.BadRequestException('Invalid code');
        }
        const ok = await this.checkReplay(userId, code);
        if (!ok) {
            await this.logAudit('2FA_ENROLL_FAILURE', userId, 'replay_attempt');
            throw new common_1.BadRequestException('This code has already been used');
        }
        const { plainCodes, hashedCodes } = this.backupCode.generate();
        await this.prisma.$transaction(async (tx) => {
            await tx.userTwoFactor.update({
                where: { userId },
                data: {
                    enabled: true,
                    enrollmentToken: null,
                    enrollmentExpiresAt: null,
                },
            });
            await tx.backupCode.createMany({
                data: hashedCodes.map((hash) => ({
                    twoFactorId: record.id,
                    codeHash: hash,
                })),
            });
        });
        this.logger.log(`2FA enabled for user ${userId}`);
        return { success: true, backupCodes: plainCodes };
    }
    async verifyLogin(userId, code) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!record || !record.enabled)
            return false;
        const decryptedSecret = this.encryption.decrypt(record.secret);
        const verifyResult = await (0, otplib_1.verify)({ secret: decryptedSecret, token: code });
        if (!verifyResult.valid) {
            await this.logAudit('2FA_VERIFY_FAILURE', userId, 'invalid_code', {
                context: 'login',
            });
            return false;
        }
        const ok = await this.checkReplay(userId, code);
        if (!ok) {
            await this.logAudit('2FA_VERIFY_FAILURE', userId, 'replay_attempt', {
                context: 'login',
            });
            return false;
        }
        return true;
    }
    async verifyStepUp(userId, code, action, resourceId) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!record || !record.enabled) {
            await this.logAudit('2FA_STEPUP_FAILURE', userId, 'not_enabled');
            throw new common_1.UnauthorizedException('Two-factor authentication is not enabled');
        }
        const decryptedSecret = this.encryption.decrypt(record.secret);
        const verifyResult = await (0, otplib_1.verify)({ secret: decryptedSecret, token: code });
        if (!verifyResult.valid) {
            await this.logAudit('2FA_STEPUP_FAILURE', userId, 'invalid_code');
            throw new common_1.UnauthorizedException('Invalid code');
        }
        const ok = await this.checkReplay(userId, code);
        if (!ok) {
            await this.logAudit('2FA_STEPUP_FAILURE', userId, 'replay_attempt');
            throw new common_1.UnauthorizedException('This code has already been used');
        }
        await this.prisma.userTwoFactor.update({
            where: { userId },
            data: { lastVerifiedAt: new Date() },
        });
        const tokenClaims = {
            sub: userId,
            purpose: '2fa_step_up',
            '2fa_verified_at': Math.floor(Date.now() / 1000),
        };
        if (action)
            tokenClaims.action = action;
        if (resourceId)
            tokenClaims.resourceId = resourceId;
        const stepUpToken = this.jwt.sign(tokenClaims, {
            secret: this.tempSecret,
            expiresIn: STEP_UP_VERIFIED_EXPIRY,
        });
        return stepUpToken;
    }
    async verifyBackupCode(userId, code) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
            include: { backupCodes: true },
        });
        if (!record || !record.enabled) {
            await this.logAudit('2FA_BACKUP_FAILURE', userId, 'not_enabled');
            throw new common_1.UnauthorizedException('Two-factor authentication is not enabled');
        }
        const matchingCode = record.backupCodes.find((bc) => !bc.usedAt && this.backupCode.verify(code, bc.codeHash));
        if (!matchingCode) {
            await this.logAudit('2FA_BACKUP_FAILURE', userId, 'invalid_or_used_code');
            throw new common_1.UnauthorizedException('Invalid or already used backup code');
        }
        await this.prisma.backupCode.update({
            where: { id: matchingCode.id },
            data: { usedAt: new Date() },
        });
        const remaining = record.backupCodes.filter((bc) => bc.id !== matchingCode.id && !bc.usedAt).length;
        return remaining;
    }
    async regenerateBackupCodes(userId) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!record || !record.enabled) {
            throw new common_1.BadRequestException('Two-factor authentication is not enabled');
        }
        const { plainCodes, hashedCodes } = this.backupCode.generate();
        await this.prisma.$transaction(async (tx) => {
            await tx.backupCode.deleteMany({ where: { twoFactorId: record.id } });
            await tx.backupCode.createMany({
                data: hashedCodes.map((hash) => ({
                    twoFactorId: record.id,
                    codeHash: hash,
                })),
            });
        });
        return plainCodes;
    }
    async disable(userId) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
        });
        if (!record || !record.enabled) {
            throw new common_1.BadRequestException('Two-factor authentication is not enabled');
        }
        await this.prisma.userTwoFactor.delete({ where: { userId } });
        this.logger.log(`2FA disabled for user ${userId}`);
    }
    async generateTempToken(userId) {
        const record = await this.prisma.userTwoFactor.findUnique({
            where: { userId },
            select: { id: true },
        });
        const tempToken = this.jwt.sign({ sub: userId, purpose: '2fa_login' }, { secret: this.tempSecret, expiresIn: STEP_UP_TEMP_EXPIRY });
        return {
            tempToken,
            factorId: record?.id ?? 'unknown',
        };
    }
    async cleanupExpiredEnrollments() {
        const result = await this.prisma.userTwoFactor.deleteMany({
            where: {
                enabled: false,
                enrollmentExpiresAt: { lt: new Date() },
            },
        });
        if (result.count > 0) {
            this.logger.log(`Cleaned up ${result.count} expired 2FA enrollments`);
        }
        return result.count;
    }
};
exports.TwoFactorService = TwoFactorService;
exports.TwoFactorService = TwoFactorService = TwoFactorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(redis_module_1.REDIS_CLIENT)),
    __metadata("design:paramtypes", [ioredis_1.default,
        prisma_service_1.PrismaService,
        jwt_1.JwtService,
        config_1.ConfigService,
        encryption_service_1.EncryptionService,
        backup_code_service_1.BackupCodeService])
], TwoFactorService);
//# sourceMappingURL=two-factor.service.js.map