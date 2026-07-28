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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccountLinkingService = exports.ACCOUNT_REPOSITORY = void 0;
const common_1 = require("@nestjs/common");
const account_repository_interface_1 = require("../interfaces/account-repository.interface");
const auth_errors_1 = require("../errors/auth.errors");
const audit_logger_interface_1 = require("../interfaces/audit-logger.interface");
exports.ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');
let AccountLinkingService = class AccountLinkingService {
    constructor(accountRepository, auditLogger) {
        this.accountRepository = accountRepository;
        this.auditLogger = auditLogger;
    }
    async handleOAuthSignIn(profile, encryptedAccessToken, encryptedRefreshToken) {
        const existingLink = await this.accountRepository.findOAuthAccount(profile.provider, profile.providerAccountId);
        if (existingLink !== null) {
            const user = await this.accountRepository.findUserById(existingLink.userId);
            if (user === null) {
                throw new auth_errors_1.ProviderIdentityAlreadyLinkedError();
            }
            return { kind: 'LOGIN', user };
        }
        const existingUserByEmail = await this.accountRepository.findUserByEmail(profile.email);
        if (existingUserByEmail === null) {
            const newUser = await this.accountRepository.createUserWithOAuthAccount({
                email: profile.email,
                emailVerified: profile.emailVerified,
                firstName: profile.firstName,
                lastName: profile.lastName,
                avatarUrl: profile.avatarUrl,
                provider: profile.provider,
                providerAccountId: profile.providerAccountId,
                encryptedAccessToken,
                encryptedRefreshToken,
                tokenExpiresAt: profile.tokenExpiresAt,
            });
            return { kind: 'SIGNUP', user: newUser };
        }
        if (!profile.emailVerified) {
            await this.auditLogger.log('AccountLinkRejected', existingUserByEmail.id, {
                reason: 'unverified_email',
                provider: profile.provider,
            });
            throw new auth_errors_1.UnverifiedEmailLinkAttemptError(profile.email);
        }
        const confirmationToken = await this.accountRepository.issueVerificationToken(existingUserByEmail.id, account_repository_interface_1.VerificationTokenType.OAUTH_LINK_CONFIRMATION);
        await this.auditLogger.log('AccountLinkAttempt', existingUserByEmail.id, {
            provider: profile.provider,
        });
        return {
            kind: 'PENDING_CONFIRMATION',
            candidateUserId: existingUserByEmail.id,
            candidateEmail: existingUserByEmail.email,
            confirmationToken,
        };
    }
    async confirmPendingLink(confirmationToken, profile, encryptedAccessToken, encryptedRefreshToken) {
        const consumed = await this.accountRepository.consumeVerificationToken(confirmationToken, account_repository_interface_1.VerificationTokenType.OAUTH_LINK_CONFIRMATION);
        if (consumed === null) {
            throw new auth_errors_1.InvalidLinkConfirmationTokenError();
        }
        const alreadyLinked = await this.accountRepository.findOAuthAccount(profile.provider, profile.providerAccountId);
        if (alreadyLinked !== null && alreadyLinked.userId !== consumed.userId) {
            throw new auth_errors_1.ProviderIdentityAlreadyLinkedError();
        }
        if (alreadyLinked !== null && alreadyLinked.userId === consumed.userId) {
            const existingUser = await this.accountRepository.findUserById(consumed.userId);
            if (existingUser === null) {
                throw new auth_errors_1.InvalidLinkConfirmationTokenError();
            }
            return existingUser;
        }
        const preAttachUser = await this.accountRepository.findUserById(consumed.userId);
        if (preAttachUser === null) {
            throw new auth_errors_1.InvalidLinkConfirmationTokenError();
        }
        try {
            await this.accountRepository.attachOAuthAccount({
                userId: consumed.userId,
                provider: profile.provider,
                providerAccountId: profile.providerAccountId,
                encryptedAccessToken,
                encryptedRefreshToken,
                tokenExpiresAt: profile.tokenExpiresAt,
            });
        }
        catch {
            throw new auth_errors_1.InvalidLinkConfirmationTokenError();
        }
        const user = await this.accountRepository.findUserById(consumed.userId);
        if (user === null) {
            throw new auth_errors_1.InvalidLinkConfirmationTokenError();
        }
        await this.auditLogger.log('AccountLinkSucceeded', user.id, {
            provider: profile.provider,
        });
        return user;
    }
};
exports.AccountLinkingService = AccountLinkingService;
exports.AccountLinkingService = AccountLinkingService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(exports.ACCOUNT_REPOSITORY)),
    __param(1, (0, common_1.Inject)(audit_logger_interface_1.AUDIT_LOGGER)),
    __metadata("design:paramtypes", [Object, Object])
], AccountLinkingService);
//# sourceMappingURL=account-linking.service.js.map