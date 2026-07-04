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
var KycService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const uploads_service_1 = require("../uploads/uploads.service");
const client_1 = require("@prisma/client");
let KycService = KycService_1 = class KycService {
    constructor(prisma, uploadsService, kycProvider) {
        this.prisma = prisma;
        this.uploadsService = uploadsService;
        this.kycProvider = kycProvider;
        this.logger = new common_1.Logger(KycService_1.name);
        this.autoApproveThreshold = 80.0;
        this.autoRejectThreshold = 50.0;
    }
    async submitVerification(userId, documentType, documentFile, faceScanFile) {
        if (!documentFile || !faceScanFile) {
            throw new common_1.BadRequestException('Both identification document and live face scan files are required.');
        }
        const existing = await this.prisma.kycVerification.findUnique({
            where: { userId },
        });
        if (existing) {
            if (existing.status === client_1.KycStatus.PENDING) {
                throw new common_1.ConflictException('You have a verification pending review. Please wait.');
            }
            if (existing.status === client_1.KycStatus.APPROVED) {
                throw new common_1.ConflictException('Your account is already KYC verified.');
            }
        }
        this.logger.log(`Uploading KYC files to private storage for user: ${userId}`);
        const [docUpload, faceUpload] = await Promise.all([
            this.uploadsService.uploadFile(documentFile, 'kyc-documents/ids'),
            this.uploadsService.uploadFile(faceScanFile, 'kyc-documents/selfies'),
        ]);
        this.logger.log(`Invoking face matching and liveness verification provider`);
        const providerResult = await this.kycProvider.verify(documentFile.buffer, faceScanFile.buffer);
        let status = client_1.KycStatus.PENDING;
        let rejectionReason = providerResult.rejectionReason || null;
        if (providerResult.isDocumentValid &&
            providerResult.livenessPassed &&
            providerResult.matchScore >= this.autoApproveThreshold) {
            status = client_1.KycStatus.APPROVED;
        }
        else if (!providerResult.isDocumentValid ||
            !providerResult.livenessPassed ||
            providerResult.matchScore < this.autoRejectThreshold) {
            status = client_1.KycStatus.REJECTED;
            if (!rejectionReason) {
                rejectionReason = `Verification failed. Face Match: ${providerResult.matchScore}%. Liveness: ${providerResult.livenessPassed}. Document Valid: ${providerResult.isDocumentValid}.`;
            }
        }
        const result = await this.prisma.$transaction(async (tx) => {
            const kyc = await tx.kycVerification.upsert({
                where: { userId },
                update: {
                    documentType,
                    documentUrl: docUpload.publicUrl,
                    faceScanUrl: faceUpload.publicUrl,
                    status,
                    matchScore: providerResult.matchScore,
                    livenessPassed: providerResult.livenessPassed,
                    rejectionReason,
                    verifiedAt: status === client_1.KycStatus.APPROVED ? new Date() : null,
                },
                create: {
                    userId,
                    documentType,
                    documentUrl: docUpload.publicUrl,
                    faceScanUrl: faceUpload.publicUrl,
                    status,
                    matchScore: providerResult.matchScore,
                    livenessPassed: providerResult.livenessPassed,
                    rejectionReason,
                    verifiedAt: status === client_1.KycStatus.APPROVED ? new Date() : null,
                },
            });
            await tx.user.update({
                where: { id: userId },
                data: { kycVerified: status === client_1.KycStatus.APPROVED },
            });
            await tx.eventLog.create({
                data: {
                    eventType: `kyc.submitted.${status.toLowerCase()}`,
                    entityId: kyc.id,
                    entityType: 'KycVerification',
                    payload: {
                        userId,
                        status,
                        matchScore: providerResult.matchScore,
                        livenessPassed: providerResult.livenessPassed,
                        isDocumentValid: providerResult.isDocumentValid,
                    },
                    processedBy: KycService_1.name,
                },
            });
            return kyc;
        });
        return {
            status: result.status,
            matchScore: result.matchScore,
            livenessPassed: result.livenessPassed,
            rejectionReason: result.rejectionReason,
            verifiedAt: result.verifiedAt,
        };
    }
    async getVerificationStatus(userId) {
        const kyc = await this.prisma.kycVerification.findUnique({
            where: { userId },
        });
        if (!kyc) {
            throw new common_1.NotFoundException('No KYC record found for this user.');
        }
        return kyc;
    }
    async getPendingVerifications() {
        return this.prisma.kycVerification.findMany({
            where: { status: client_1.KycStatus.PENDING },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
            },
            orderBy: { createdAt: 'asc' },
        });
    }
    async approveVerification(id, adminId) {
        const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
        if (!kyc)
            throw new common_1.NotFoundException('KYC verification record not found.');
        return this.prisma.$transaction(async (tx) => {
            const updatedKyc = await tx.kycVerification.update({
                where: { id },
                data: {
                    status: client_1.KycStatus.APPROVED,
                    rejectionReason: null,
                    verifiedAt: new Date(),
                },
            });
            await tx.user.update({
                where: { id: kyc.userId },
                data: { kycVerified: true },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'kyc.approved',
                    entityId: id,
                    entityType: 'KycVerification',
                    payload: { adminId, userId: kyc.userId },
                    processedBy: KycService_1.name,
                },
            });
            return updatedKyc;
        });
    }
    async rejectVerification(id, adminId, reason) {
        if (!reason || reason.trim().length === 0) {
            throw new common_1.BadRequestException('Rejection reason must be provided.');
        }
        const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
        if (!kyc)
            throw new common_1.NotFoundException('KYC verification record not found.');
        return this.prisma.$transaction(async (tx) => {
            const updatedKyc = await tx.kycVerification.update({
                where: { id },
                data: {
                    status: client_1.KycStatus.REJECTED,
                    rejectionReason: reason,
                    verifiedAt: null,
                },
            });
            await tx.user.update({
                where: { id: kyc.userId },
                data: { kycVerified: false },
            });
            await tx.eventLog.create({
                data: {
                    eventType: 'kyc.rejected',
                    entityId: id,
                    entityType: 'KycVerification',
                    payload: { adminId, userId: kyc.userId, reason },
                    processedBy: KycService_1.name,
                },
            });
            return updatedKyc;
        });
    }
};
exports.KycService = KycService;
exports.KycService = KycService = KycService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, common_1.Inject)('KycProvider')),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        uploads_service_1.UploadsService, Object])
], KycService);
//# sourceMappingURL=kyc.service.js.map