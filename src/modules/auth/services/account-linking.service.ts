import { Inject, Injectable } from '@nestjs/common';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import {
  IAccountRepository,
  VerificationTokenType,
} from '../interfaces/account-repository.interface';
import {
  OAuthSignInOutcome,
} from '../interfaces/link-account-result.interface';
import {
  InvalidLinkConfirmationTokenError,
  ProviderIdentityAlreadyLinkedError,
  UnverifiedEmailLinkAttemptError,
} from '../errors/auth.errors';
import { IAuditLogger, AUDIT_LOGGER } from '../interfaces/audit-logger.interface';

/**
 * Injection token for the {@link IAccountRepository} implementation.
 * Using an explicit token (rather than the interface itself, which does
 * not exist at runtime in TypeScript) is the standard NestJS pattern for
 * injecting by abstraction rather than by concrete class.
 */
export const ACCOUNT_REPOSITORY = Symbol('ACCOUNT_REPOSITORY');

/**
 * Encapsulates all decision-making for matching an incoming OAuth/OIDC
 * profile to a Beleqet user account, and for safely attaching new
 * provider identities to existing accounts.
 *
 * ## Security model
 *
 * This service is the sole guard against account-hijacking via OAuth.
 * The rules it enforces, in order:
 *
 * 1. **Existing link wins.** If `(provider, providerAccountId)` is already
 *    linked to a user, this is a normal login — no linking decision needed.
 * 2. **No email match → provision.** If no user exists with the profile's
 *    email, a new user is created and the identity attached. This is a
 *    normal signup.
 * 3. **Email match requires provider-verified email.** If an existing user
 *    has that email, the incoming profile's email MUST be verified by the
 *    provider (`emailVerified === true`). An unverified email match is
 *    rejected outright — it is the textbook hijack vector (attacker
 *    registers an OAuth identity using a victim's unverified email).
 * 4. **Verified email match is still NOT auto-linked.** Even with a
 *    provider-verified email, we never silently merge accounts. Instead a
 *    confirmation token is issued and the caller must complete an explicit
 *    confirmation step (see {@link confirmPendingLink}) — typically via a
 *    link mailed to the account's registered email, or the user
 *    authenticating with their existing credential first.
 *
 * This means automatic account takeover by email match alone is
 * impossible under any code path in this service.
 *
 * @remarks
 * This service is intentionally decoupled from Prisma, Passport, and
 * HTTP concerns — it depends only on {@link IAccountRepository}. This
 * makes it fully unit-testable with a mocked repository and reusable
 * regardless of which OAuth transport library sits in front of it.
 */
@Injectable()
export class AccountLinkingService {
  constructor(
    @Inject(ACCOUNT_REPOSITORY)
    private readonly accountRepository: IAccountRepository,
    @Inject(AUDIT_LOGGER)
    private readonly auditLogger: IAuditLogger,
  ) {}

  /**
   * Processes an incoming, normalized OAuth profile from a completed
   * provider sign-in and determines the correct outcome: login, signup,
   * or pending manual confirmation.
   *
   * @param profile - Normalized profile produced by the calling Passport
   *   strategy's `validate()` method.
   * @param encryptedAccessToken - The provider's access token, already
   *   encrypted by {@link TokenEncryptionService}. This service never
   *   handles plaintext tokens.
   * @param encryptedRefreshToken - Encrypted refresh token, if present.
   * @returns The resulting {@link OAuthSignInOutcome}.
   * @throws {@link UnverifiedEmailLinkAttemptError} if the profile's email
   *   matches an existing account but the provider has not verified it.
   */
  public async handleOAuthSignIn(
    profile: OAuthProfile,
    encryptedAccessToken: string,
    encryptedRefreshToken?: string,
  ): Promise<OAuthSignInOutcome> {
    const existingLink = await this.accountRepository.findOAuthAccount(
      profile.provider,
      profile.providerAccountId,
    );

    if (existingLink !== null) {
      const user = await this.accountRepository.findUserById(
        existingLink.userId,
      );

      if (user === null) {
        // Data integrity edge case: a linked OAuthAccount row survived
        // the deletion of its parent User. Treat as if unlinked rather
        // than silently failing, so the caller gets a clear path forward.
        throw new ProviderIdentityAlreadyLinkedError();
      }

      return { kind: 'LOGIN', user };
    }

    const existingUserByEmail = await this.accountRepository.findUserByEmail(
      profile.email,
    );

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

    // An account with this email already exists. From here on, linking
    // is NEVER automatic — see class-level doc for the full rationale.
    if (!profile.emailVerified) {
      await this.auditLogger.log('AccountLinkRejected', existingUserByEmail.id, {
        reason: 'unverified_email',
        provider: profile.provider,
      });
      throw new UnverifiedEmailLinkAttemptError(profile.email);
    }

    const confirmationToken = await this.accountRepository.issueVerificationToken(
      existingUserByEmail.id,
      VerificationTokenType.OAUTH_LINK_CONFIRMATION,
    );

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

  /**
   * Completes a previously-issued pending link after the user has proven
   * ownership of the confirmation token (e.g. by clicking an emailed
   * link, or via an authenticated "connect provider" action combined with
   * a freshly issued token).
   *
   * @param confirmationToken - The opaque token issued during
   *   {@link handleOAuthSignIn}'s `PENDING_CONFIRMATION` outcome.
   * @param profile - The same OAuth profile that triggered the pending
   *   state. Re-validated here so a stale/replayed profile from a
   *   different provider identity cannot be substituted in.
   * @param encryptedAccessToken - Encrypted access token to persist.
   * @param encryptedRefreshToken - Encrypted refresh token, if present.
   * @returns The user the provider identity was attached to.
   * @throws {@link InvalidLinkConfirmationTokenError} if the token is
   *   missing, expired, already used, or of the wrong type.
   */
  public async confirmPendingLink(
    confirmationToken: string,
    profile: OAuthProfile,
    encryptedAccessToken: string,
    encryptedRefreshToken?: string,
  ): Promise<import('../interfaces/account-repository.interface').UserIdentitySnapshot> {
    const consumed = await this.accountRepository.consumeVerificationToken(
      confirmationToken,
      VerificationTokenType.OAUTH_LINK_CONFIRMATION,
    );

    if (consumed === null) {
      throw new InvalidLinkConfirmationTokenError();
    }

    const alreadyLinked = await this.accountRepository.findOAuthAccount(
      profile.provider,
      profile.providerAccountId,
    );

    if (alreadyLinked !== null && alreadyLinked.userId !== consumed.userId) {
      throw new ProviderIdentityAlreadyLinkedError();
    }

    if (alreadyLinked !== null && alreadyLinked.userId === consumed.userId) {
      // Idempotent case: the identity is already linked to this SAME
      // user — e.g. the user clicked the confirmation email twice, or a
      // race condition delivered two concurrent confirm requests.
      // Treat as success rather than attempting a duplicate insert,
      // which would otherwise crash with a 500 on the
      // @@unique([provider, providerAccountId]) constraint.
      const existingUser = await this.accountRepository.findUserById(consumed.userId);
      if (existingUser === null) {
        throw new InvalidLinkConfirmationTokenError();
      }
      return existingUser;
    }

    // Verify the user still exists before attempting to attach — closes
    // most of the race window where the account could have been deleted
    // concurrently between token consumption and this point.
    const preAttachUser = await this.accountRepository.findUserById(consumed.userId);
    if (preAttachUser === null) {
      throw new InvalidLinkConfirmationTokenError();
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
    } catch {
      // Defense-in-depth for the narrow remaining race: the user could
      // still be deleted in the moment between the check above and this
      // insert, which fails the OAuthAccount->User foreign key
      // constraint (Prisma P2003). Rather than importing Prisma-specific
      // error types into this DB-agnostic service, treat ANY failure
      // here as an invalid/expired confirmation — the safest generic
      // response — instead of letting it surface as an unhandled 500.
      throw new InvalidLinkConfirmationTokenError();
    }

    const user = await this.accountRepository.findUserById(consumed.userId);

    if (user === null) {
      throw new InvalidLinkConfirmationTokenError();
    }

    await this.auditLogger.log('AccountLinkSucceeded', user.id, {
      provider: profile.provider,
    });

    return user;
  }
}
