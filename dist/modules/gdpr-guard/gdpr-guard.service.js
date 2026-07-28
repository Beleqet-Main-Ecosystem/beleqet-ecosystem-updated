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
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprGuardService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../prisma/prisma.service");
const crypto = require("crypto");
const GATEWAY_RESPONSE_PII_KEYS = new Set([
    'first_name',
    'last_name',
    'email',
    'mobile',
    'account_name',
    'account_number',
]);
let GdprGuardService = class GdprGuardService {
    constructor(prisma) {
        this.prisma = prisma;
        this.algorithm = 'aes-256-gcm';
        this.ivLength = 12;
        const keyEnv = process.env.GDPR_ENCRYPTION_KEY;
        if (!keyEnv || keyEnv.length !== 64) {
            throw new common_1.InternalServerErrorException('GDPR_ENCRYPTION_KEY must be defined in environment variables as a 64-character hex string.');
        }
        this.secretKey = Buffer.from(keyEnv, 'hex');
    }
    encryptPii(text) {
        if (!text)
            return text;
        try {
            const iv = crypto.randomBytes(this.ivLength);
            const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv);
            let encrypted = cipher.update(text, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            const authTag = cipher.getAuthTag().toString('hex');
            return `${iv.toString('hex')}:${authTag}:${encrypted}`;
        }
        catch {
            throw new common_1.InternalServerErrorException('Failed to securely encrypt personal identifiable information.');
        }
    }
    decryptPii(encryptedText) {
        if (!encryptedText || !encryptedText.includes(':'))
            return encryptedText;
        try {
            const [ivHex, authTagHex, encryptedDataHex] = encryptedText.split(':');
            const iv = Buffer.from(ivHex, 'hex');
            const authTag = Buffer.from(authTagHex, 'hex');
            const decipher = crypto.createDecipheriv(this.algorithm, this.secretKey, iv);
            decipher.setAuthTag(authTag);
            let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch {
            throw new common_1.InternalServerErrorException('Failed to decrypt personal identifiable information.');
        }
    }
    scrubGatewayResponsePii(value) {
        if (Array.isArray(value)) {
            return value.map((item) => this.scrubGatewayResponsePii(item));
        }
        if (value !== null && typeof value === 'object') {
            const result = {};
            for (const [key, nested] of Object.entries(value)) {
                if (GATEWAY_RESPONSE_PII_KEYS.has(key))
                    continue;
                result[key] = this.scrubGatewayResponsePii(nested);
            }
            return result;
        }
        return value;
    }
    async executeDataErasure(userUuid, audit) {
        const user = await this.prisma.user.findUnique({
            where: { id: userUuid },
            include: { wallet: true, employerWallet: true, company: true },
        });
        if (!user) {
            throw new common_1.NotFoundException(`User with ID ${userUuid} was not found in the ecosystem.`);
        }
        const scrubbedAt = new Date().toISOString();
        const referenceId = crypto.randomBytes(8).toString('hex').toUpperCase();
        const scrubbedEmail = `scrubbed-${crypto.randomBytes(4).toString('hex')}@beleqet.internal`;
        const originalEmail = user.email;
        await this.prisma.$transaction(async (tx) => {
            await tx.contactMessage.updateMany({
                where: { email: originalEmail },
                data: {
                    name: 'GDPR_ANONYMOUS',
                    email: scrubbedEmail,
                    message: 'GDPR_SCRUBBED',
                    subject: 'GDPR_SCRUBBED',
                },
            });
            await tx.user.update({
                where: { id: userUuid },
                data: {
                    firstName: 'GDPR_ANONYMOUS',
                    lastName: 'USER',
                    email: scrubbedEmail,
                    phone: null,
                    avatarUrl: null,
                    telegramId: null,
                    bio: null,
                    headline: null,
                    location: null,
                    skills: [],
                    defaultResumeUrl: null,
                    githubUrl: null,
                    linkedinUrl: null,
                    portfolioUrl: null,
                    clientFeedback: client_1.Prisma.DbNull,
                    passwordHash: crypto.randomBytes(32).toString('hex'),
                    isActive: false,
                    emailVerified: false,
                    gdprConsent: false,
                    kycVerified: false,
                    skillVerified: false,
                },
            });
            await tx.refreshToken.deleteMany({ where: { userId: userUuid } });
            await tx.verificationToken.deleteMany({ where: { userId: userUuid } });
            await tx.oAuthAccount.deleteMany({ where: { userId: userUuid } });
            await tx.userTwoFactor.deleteMany({ where: { userId: userUuid } });
            await tx.kycVerification.deleteMany({ where: { userId: userUuid } });
            await tx.cvDraft.deleteMany({ where: { userId: userUuid } });
            await tx.searchHistory.deleteMany({ where: { userId: userUuid } });
            await tx.jobAlert.deleteMany({ where: { userId: userUuid } });
            await tx.savedJob.deleteMany({ where: { userId: userUuid } });
            await tx.notification.deleteMany({ where: { userId: userUuid } });
            await tx.skillAssessmentSession.deleteMany({ where: { userId: userUuid } });
            await tx.application.updateMany({
                where: { userId: userUuid },
                data: {
                    coverLetter: null,
                    resumeUrl: null,
                    notes: null,
                    portfolioUrl: null,
                    screeningAnswers: client_1.Prisma.DbNull,
                },
            });
            await tx.candidateScore.updateMany({
                where: { userId: userUuid },
                data: { reasoning: null, rawAiResponse: client_1.Prisma.DbNull },
            });
            await tx.bid.updateMany({
                where: { freelancerId: userUuid },
                data: { coverLetter: 'GDPR_SCRUBBED' },
            });
            await tx.freelanceJob.updateMany({
                where: { clientId: userUuid },
                data: {
                    title: '[Removed]',
                    description: 'GDPR_SCRUBBED',
                    attachments: [],
                    locationPreference: null,
                },
            });
            const escrows = await tx.escrowTransaction.findMany({
                where: { freelanceJob: { clientId: userUuid }, gatewayResponse: { not: client_1.Prisma.DbNull } },
                select: { id: true, gatewayResponse: true },
            });
            for (const escrow of escrows) {
                await tx.escrowTransaction.update({
                    where: { id: escrow.id },
                    data: {
                        gatewayResponse: this.scrubGatewayResponsePii(escrow.gatewayResponse),
                    },
                });
            }
            await tx.dispute.updateMany({
                where: { raisedById: userUuid },
                data: {
                    reason: 'GDPR_SCRUBBED',
                    evidenceUrls: [],
                },
            });
            await tx.dispute.updateMany({
                where: { raisedById: userUuid, resolution: { not: null } },
                data: { resolution: 'GDPR_SCRUBBED' },
            });
            const contracts = await tx.contract.findMany({
                where: { OR: [{ clientId: userUuid }, { freelancerId: userUuid }] },
                select: { id: true },
            });
            const contractIds = contracts.map((c) => c.id);
            if (contractIds.length > 0) {
                const milestones = await tx.milestone.findMany({
                    where: { contractId: { in: contractIds } },
                    select: { id: true },
                });
                const milestoneIds = milestones.map((m) => m.id);
                if (milestoneIds.length > 0) {
                    await tx.milestone.updateMany({
                        where: { id: { in: milestoneIds } },
                        data: {
                            title: '[Removed]',
                            description: 'GDPR_SCRUBBED',
                        },
                    });
                    await tx.deliverable.updateMany({
                        where: { milestoneId: { in: milestoneIds } },
                        data: {
                            fileUrl: null,
                            notes: 'GDPR_SCRUBBED',
                        },
                    });
                }
            }
            await tx.message.updateMany({
                where: { senderId: userUuid },
                data: { content: 'GDPR_SCRUBBED', metadata: client_1.Prisma.DbNull },
            });
            await tx.interview.updateMany({
                where: { OR: [{ candidateId: userUuid }, { employerId: userUuid }] },
                data: { notes: null, meetingLink: null },
            });
            const videoInterviews = await tx.videoInterview.findMany({
                where: { userId: userUuid },
                select: { id: true },
            });
            const videoInterviewIds = videoInterviews.map((v) => v.id);
            if (videoInterviewIds.length > 0) {
                await tx.videoResponse.updateMany({
                    where: { videoInterviewId: { in: videoInterviewIds } },
                    data: {
                        videoUrl: null,
                        transcript: null,
                        rawWhisperResponse: client_1.Prisma.DbNull,
                    },
                });
                await tx.interviewEvaluation.updateMany({
                    where: { videoInterviewId: { in: videoInterviewIds } },
                    data: {
                        scores: {},
                        reasoning: null,
                        rawAiResponse: client_1.Prisma.DbNull,
                        gdprDeleteAt: new Date(scrubbedAt),
                    },
                });
                await tx.videoInterview.updateMany({
                    where: { id: { in: videoInterviewIds } },
                    data: {
                        metadata: {},
                        gdprDeleteAt: new Date(scrubbedAt),
                    },
                });
            }
            await tx.storedFile.updateMany({
                where: { uploadedById: userUuid, isDeleted: false },
                data: {
                    isDeleted: true,
                    deletedAt: new Date(scrubbedAt),
                    filename: 'GDPR_SCRUBBED',
                    hasConsentedToProcessing: false,
                },
            });
            if (user.company) {
                await tx.company.update({
                    where: { id: user.company.id },
                    data: {
                        name: 'GDPR_ANONYMOUS_COMPANY',
                        description: null,
                        logoUrl: null,
                        website: null,
                        coverImageUrl: null,
                        facebookUrl: null,
                        linkedinUrl: null,
                        twitterUrl: null,
                        location: null,
                    },
                });
                await tx.job.updateMany({
                    where: { companyId: user.company.id },
                    data: {
                        applyEmail: null,
                        contactPhone: null,
                        companyName: 'GDPR_ANONYMOUS_COMPANY',
                        companyLogo: null,
                    },
                });
            }
            const subscriptions = await tx.subscription.findMany({
                where: { userId: userUuid },
                select: { id: true },
            });
            if (subscriptions.length > 0) {
                await tx.subscriptionTransaction.updateMany({
                    where: { subscriptionId: { in: subscriptions.map((s) => s.id) } },
                    data: { rawPayload: client_1.Prisma.DbNull },
                });
            }
            if (user.wallet) {
                await tx.walletTransaction.updateMany({
                    where: { walletId: user.wallet.id, note: { not: null } },
                    data: { note: 'GDPR_SCRUBBED' },
                });
            }
            if (user.employerWallet) {
                await tx.employerWalletTransaction.updateMany({
                    where: { walletId: user.employerWallet.id, note: { not: null } },
                    data: { note: 'GDPR_SCRUBBED' },
                });
            }
            await tx.eventLog.create({
                data: {
                    eventType: 'GDPR_DATA_ERASURE',
                    entityId: userUuid,
                    entityType: 'User',
                    payload: {
                        reason: audit.reason,
                        actorUserId: audit.actorUserId,
                        targetUserId: userUuid,
                        referenceId,
                        scrubbedAt,
                    },
                    processedBy: audit.actorUserId,
                },
            });
        });
        return { success: true, scrubbedAt, referenceId };
    }
};
exports.GdprGuardService = GdprGuardService;
exports.GdprGuardService = GdprGuardService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], GdprGuardService);
//# sourceMappingURL=gdpr-guard.service.js.map