"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProviderIdentityAlreadyLinkedError = exports.InvalidLinkConfirmationTokenError = exports.AccountLinkPendingConfirmationError = exports.UnverifiedEmailLinkAttemptError = exports.AuthDomainError = void 0;
class AuthDomainError extends Error {
    constructor(message) {
        super(message);
        this.name = new.target.name;
    }
}
exports.AuthDomainError = AuthDomainError;
class UnverifiedEmailLinkAttemptError extends AuthDomainError {
    constructor(email) {
        super(`Cannot link or sign in: provider did not verify ownership of email "${email}".`);
    }
}
exports.UnverifiedEmailLinkAttemptError = UnverifiedEmailLinkAttemptError;
class AccountLinkPendingConfirmationError extends AuthDomainError {
    constructor(candidateUserId) {
        super('An account with this email already exists. Explicit confirmation is required before linking this provider.');
        this.candidateUserId = candidateUserId;
    }
}
exports.AccountLinkPendingConfirmationError = AccountLinkPendingConfirmationError;
class InvalidLinkConfirmationTokenError extends AuthDomainError {
    constructor() {
        super('The link-confirmation token is invalid, expired, or already used.');
    }
}
exports.InvalidLinkConfirmationTokenError = InvalidLinkConfirmationTokenError;
class ProviderIdentityAlreadyLinkedError extends AuthDomainError {
    constructor() {
        super('This social account is already linked to a different user.');
    }
}
exports.ProviderIdentityAlreadyLinkedError = ProviderIdentityAlreadyLinkedError;
//# sourceMappingURL=auth.errors.js.map