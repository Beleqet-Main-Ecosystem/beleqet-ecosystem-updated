import { UserIdentitySnapshot } from './account-repository.interface';
export interface LoginOutcome {
    readonly kind: 'LOGIN';
    readonly user: UserIdentitySnapshot;
}
export interface SignupOutcome {
    readonly kind: 'SIGNUP';
    readonly user: UserIdentitySnapshot;
}
export interface PendingConfirmationOutcome {
    readonly kind: 'PENDING_CONFIRMATION';
    readonly candidateUserId: string;
    readonly candidateEmail: string;
    readonly confirmationToken: string;
}
export type OAuthSignInOutcome = LoginOutcome | SignupOutcome | PendingConfirmationOutcome;
