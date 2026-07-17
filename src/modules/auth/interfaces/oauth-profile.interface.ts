/**
 * Supported OAuth/OIDC identity providers for the Social Logins module.
 *
 * This mirrors the `OAuthProvider` enum defined in `schema.prisma` and
 * must be kept in sync with it.
 */
import { OAuthProvider } from '@prisma/client';
export { OAuthProvider };

/**
 * A normalized representation of an OAuth/OIDC user profile, mapped from
 * the provider-specific raw response into a single consistent shape.
 *
 * Each Passport strategy's `validate()` method is responsible for mapping
 * Google's and LinkedIn's differing raw profile payloads into this type
 * *before* handing off to {@link AccountLinkingService}. This keeps all
 * downstream business logic provider-agnostic and fully typed (no `any`).
 *
 * @remarks
 * `emailVerified` is sourced from the provider's own ID token claim
 * (`email_verified`), never inferred from the presence of an email. This
 * distinction is the core defense against account-hijacking via unverified
 * emails at sign-in time.
 */
export interface OAuthProfile {
  /** Which provider issued this identity. */
  readonly provider: OAuthProvider;

  /**
   * The provider's stable, unique subject identifier (`sub` claim).
   * This — not the email — is the permanent, non-reusable identity anchor.
   */
  readonly providerAccountId: string;

  /** Email address as reported by the provider. May be unverified. */
  readonly email: string;

  /**
   * Whether the provider itself has verified ownership of `email`.
   * Sourced directly from the ID token's `email_verified` claim.
   * This is a *necessary but not sufficient* condition for account linking.
   */
  readonly emailVerified: boolean;

  readonly firstName: string;
  readonly lastName: string;

  /** Provider-hosted avatar URL, if available. */
  readonly avatarUrl?: string;

  /**
   * Raw access token issued by the provider for this session. Handed to
   * {@link TokenEncryptionService} for encryption before any persistence;
   * never stored or logged in plaintext.
   */
  readonly rawAccessToken: string;

  /** Raw refresh token, if the provider issued one (offline access scope). */
  readonly rawRefreshToken?: string;

  /** Access token expiry, if provided by the provider. */
  readonly tokenExpiresAt?: Date;
}
