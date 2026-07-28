export declare abstract class AuthDomainError extends Error {
    protected constructor(message: string);
}
export declare class UnverifiedEmailLinkAttemptError extends AuthDomainError {
    constructor(email: string);
}
export declare class AccountLinkPendingConfirmationError extends AuthDomainError {
    readonly candidateUserId: string;
    constructor(candidateUserId: string);
}
export declare class InvalidLinkConfirmationTokenError extends AuthDomainError {
    constructor();
}
export declare class ProviderIdentityAlreadyLinkedError extends AuthDomainError {
    constructor();
}
