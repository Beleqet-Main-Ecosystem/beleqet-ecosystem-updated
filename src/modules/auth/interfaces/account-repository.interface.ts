import { OAuthProvider } from './oauth-profile.interface';

/**
 * Minimal, provider-agnostic view of a `User` row needed by auth logic.
 * Deliberately narrow: the linking service should never need — and
 * therefore never risk mishandling — fields like `passwordHash` or
 * financial/wallet data that live on the full Prisma `User` model.
 */
export interface UserIdentitySnapshot {
  readonly id: string;
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName: string;
  readonly lastName: string;
  /** True if this User has at least one usable local password credential. */
  readonly hasPasswordCredential: boolean;
}

/** Minimal view of a linked `OAuthAccount` row. */
export interface OAuthAccountSnapshot {
  readonly userId: string;
  readonly provider: OAuthProvider;
  readonly providerAccountId: string;
}

/** Input required to provision a brand-new user purely from an OAuth signup. */
export interface CreateOAuthUserInput {
  readonly email: string;
  readonly emailVerified: boolean;
  readonly firstName: string;
  readonly lastName: string;
  readonly avatarUrl?: string;
  readonly provider: OAuthProvider;
  readonly providerAccountId: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken?: string;
  readonly tokenExpiresAt?: Date;
}

/** Input required to attach a new provider identity to an *existing* user. */
export interface AttachOAuthAccountInput {
  readonly userId: string;
  readonly provider: OAuthProvider;
  readonly providerAccountId: string;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken?: string;
  readonly tokenExpiresAt?: Date;
}

/** Categories of verification token this module issues, scoped within the
 * existing shared `VerificationToken` table via its generic `type` field. */
export enum VerificationTokenType {
  OAUTH_LINK_CONFIRMATION = 'OAUTH_LINK_CONFIRMATION',
}

/**
 * Abstraction over persistence for the auth module. The Prisma-backed
 * implementation lives in `repositories/account.repository.ts`; unit tests
 * inject a hand-written mock/fake instead, so {@link AccountLinkingService}
 * can be tested with zero database dependency.
 *
 * This interface is the Dependency Inversion boundary required by the
 * "Modular Architecture / DI" standard — services depend on this
 * abstraction, never on `PrismaService` directly.
 */
export interface IAccountRepository {
  /** Looks up an existing linked identity by provider + provider subject id. */
  findOAuthAccount(
    provider: OAuthProvider,
    providerAccountId: string,
  ): Promise<OAuthAccountSnapshot | null>;

  /** Looks up an existing user by email (case-insensitive, exact match). */
  findUserByEmail(email: string): Promise<UserIdentitySnapshot | null>;

  /** Fetches a user snapshot by id. */
  findUserById(userId: string): Promise<UserIdentitySnapshot | null>;

  /**
   * Atomically creates a brand-new user together with its first linked
   * OAuth account. Used only for genuine first-time signups (no existing
   * user with that email).
   */
  createUserWithOAuthAccount(
    input: CreateOAuthUserInput,
  ): Promise<UserIdentitySnapshot>;

  /**
   * Attaches a new provider identity to an already-existing user.
   * Callers MUST have already established authenticated intent or a
   * successful ownership challenge before calling this — the repository
   * itself performs no authorization checks.
   */
  attachOAuthAccount(input: AttachOAuthAccountInput): Promise<void>;

  /**
   * Issues a single-use, time-limited verification token scoped to a
   * given user and purpose, persisted via the existing `VerificationToken`
   * table. Returns the opaque token string to be emailed to the user.
   */
  issueVerificationToken(
    userId: string,
    type: VerificationTokenType,
  ): Promise<string>;

  /**
   * Atomically validates and consumes a verification token. Returns the
   * associated userId if the token is valid, unexpired, and of the
   * expected type; returns `null` otherwise. Implementations must delete
   * or invalidate the token on successful consumption to prevent reuse.
   */
  consumeVerificationToken(
    token: string,
    expectedType: VerificationTokenType,
  ): Promise<{ userId: string } | null>;
}
