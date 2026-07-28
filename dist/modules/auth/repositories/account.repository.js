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
exports.AccountRepository = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../../prisma/prisma.service");
const LINK_CONFIRMATION_TOKEN_TTL_MS = 30 * 60 * 1000;
let AccountRepository = class AccountRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findOAuthAccount(provider, providerAccountId) {
        const record = await this.prisma.oAuthAccount.findUnique({
            where: { provider_providerAccountId: { provider, providerAccountId } },
            select: { userId: true, provider: true, providerAccountId: true },
        });
        return record;
    }
    async findUserByEmail(email) {
        const record = await this.prisma.user.findUnique({
            where: { email: email.toLowerCase().trim() },
            select: {
                id: true,
                email: true,
                emailVerified: true,
                firstName: true,
                lastName: true,
                passwordHash: true,
            },
        });
        if (record === null) {
            return null;
        }
        return this.toSnapshot(record);
    }
    async findUserById(userId) {
        const record = await this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                emailVerified: true,
                firstName: true,
                lastName: true,
                passwordHash: true,
            },
        });
        if (record === null) {
            return null;
        }
        return this.toSnapshot(record);
    }
    async createUserWithOAuthAccount(input) {
        const created = await this.prisma.user.create({
            data: {
                email: input.email.toLowerCase().trim(),
                emailVerified: input.emailVerified,
                firstName: input.firstName,
                lastName: input.lastName,
                avatarUrl: input.avatarUrl,
                oauthAccounts: {
                    create: {
                        provider: input.provider,
                        providerAccountId: input.providerAccountId,
                        encryptedAccessToken: input.encryptedAccessToken,
                        encryptedRefreshToken: input.encryptedRefreshToken,
                        tokenExpiresAt: input.tokenExpiresAt,
                    },
                },
            },
            select: {
                id: true,
                email: true,
                emailVerified: true,
                firstName: true,
                lastName: true,
                passwordHash: true,
            },
        });
        return this.toSnapshot(created);
    }
    async attachOAuthAccount(input) {
        await this.prisma.oAuthAccount.create({
            data: {
                userId: input.userId,
                provider: input.provider,
                providerAccountId: input.providerAccountId,
                encryptedAccessToken: input.encryptedAccessToken,
                encryptedRefreshToken: input.encryptedRefreshToken,
                tokenExpiresAt: input.tokenExpiresAt,
            },
        });
    }
    async issueVerificationToken(userId, type) {
        const token = (0, crypto_1.randomBytes)(32).toString('hex');
        await this.prisma.verificationToken.create({
            data: {
                token,
                userId,
                type,
                expiresAt: new Date(Date.now() + LINK_CONFIRMATION_TOKEN_TTL_MS),
            },
        });
        return token;
    }
    async consumeVerificationToken(token, expectedType) {
        return this.prisma.$transaction(async (tx) => {
            const record = await tx.verificationToken.findUnique({
                where: { token },
                select: { id: true, userId: true, type: true, expiresAt: true },
            });
            if (record === null ||
                record.type !== expectedType ||
                record.expiresAt.getTime() < Date.now()) {
                return null;
            }
            const deleted = await tx.verificationToken.deleteMany({
                where: { id: record.id },
            });
            if (deleted.count === 0) {
                return null;
            }
            return { userId: record.userId };
        });
    }
    toSnapshot(record) {
        return {
            id: record.id,
            email: record.email,
            emailVerified: record.emailVerified,
            firstName: record.firstName,
            lastName: record.lastName,
            hasPasswordCredential: record.passwordHash !== null,
        };
    }
};
exports.AccountRepository = AccountRepository;
exports.AccountRepository = AccountRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AccountRepository);
//# sourceMappingURL=account.repository.js.map