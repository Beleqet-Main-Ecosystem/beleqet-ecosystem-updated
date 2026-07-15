/**
 * Base class for all typed errors raised by the Social Logins module.
 * Extending a common base lets controllers map auth errors to consistent
 * HTTP responses via a single NestJS exception filter, rather than
 * inspecting error messages (string matching is a code smell we avoid here).
 */
export abstract class AuthDomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * Thrown when an OAuth provider reports an email that matches an existing
 * account, but the provider has NOT verified ownership of that email
 * (`email_verified: false`).
 *
 * This is the primary hijack-prevention guard: without it, an attacker
 * could register an OAuth identity using a victim's email at a provider
 * that doesn't enforce email verification, and silently take over the
 * victim's existing account.
 */
export class UnverifiedEmailLinkAttemptError extends AuthDomainError {
  constructor(email: string) {
    super(
      `Cannot link or sign in: provider did not verify ownership of email "${email}".`,
    );
  }
}

/**
 * Thrown when an OAuth sign-in matches an existing account by email, and
 * the provider *has* verified the email, but no explicit linking consent
 * or ownership challenge has been completed yet.
 *
 * This is not a failure — it signals the caller (controller) to redirect
 * the user into the linking-confirmation flow rather than log them in
 * or silently merge accounts.
 */
export class AccountLinkPendingConfirmationError extends AuthDomainError {
  constructor(public readonly candidateUserId: string) {
    super(
      'An account with this email already exists. Explicit confirmation is required before linking this provider.',
    );
  }
}

/**
 * Thrown when a verification token presented for account-link confirmation
 * is missing, expired, already consumed, or of the wrong type.
 */
export class InvalidLinkConfirmationTokenError extends AuthDomainError {
  constructor() {
    super('The link-confirmation token is invalid, expired, or already used.');
  }
}

/**
 * Thrown when attempting to attach a provider identity that is already
 * linked to a *different* user than the one requesting the link. This
 * should be structurally prevented by the DB unique constraint as well —
 * this error represents defense-in-depth at the application layer.
 */
export class ProviderIdentityAlreadyLinkedError extends AuthDomainError {
  constructor() {
    super('This social account is already linked to a different user.');
  }
}
