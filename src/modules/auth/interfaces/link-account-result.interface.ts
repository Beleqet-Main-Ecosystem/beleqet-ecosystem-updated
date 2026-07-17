import { UserIdentitySnapshot } from './account-repository.interface';

/**
 * Outcome of an OAuth sign-in attempt where the provider identity was
 * already linked to a user. Standard login path.
 */
export interface LoginOutcome {
  readonly kind: 'LOGIN';
  readonly user: UserIdentitySnapshot;
}

/**
 * Outcome where no existing user matched, so a brand-new user was
 * provisioned and the provider identity attached to it. Standard signup
 * path.
 */
export interface SignupOutcome {
  readonly kind: 'SIGNUP';
  readonly user: UserIdentitySnapshot;
}

/**
 * Outcome where an existing user matches by email, the provider verified
 * that email, but the module deliberately withholds automatic linking.
 * The caller must route the user into an explicit confirmation flow
 * (e.g. "sign in with your password, then confirm linking Google") before
 * {@link AccountLinkingService.confirmPendingLink} is called.
 *
 * A confirmation token has already been issued and (by the caller/email
 * service) should be sent to the account's registered email address.
 */
export interface PendingConfirmationOutcome {
  readonly kind: 'PENDING_CONFIRMATION';
  readonly candidateUserId: string;
  readonly candidateEmail: string;
  readonly confirmationToken: string;
}

/**
 * The full set of possible outcomes from {@link AccountLinkingService.handleOAuthSignIn}.
 * Using a discriminated union (rather than throwing for the "pending" case)
 * keeps the pending-confirmation path — which is an expected, common
 * outcome, not an exceptional one — out of try/catch control flow.
 */
export type OAuthSignInOutcome =
  | LoginOutcome
  | SignupOutcome
  | PendingConfirmationOutcome;
