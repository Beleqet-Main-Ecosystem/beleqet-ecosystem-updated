/** Minimal view of a stored refresh token needed by TokenIssuanceService. */
export interface RefreshTokenSnapshot {
  readonly id: string;
  readonly userId: string;
  readonly expiresAt: Date;
}

/**
 * Abstraction over refresh-token persistence, backed by the existing
 * `RefreshToken` Prisma table. Storing only a SHA-256 hash of the token
 * (never the raw value) means a database leak alone cannot be used to
 * impersonate users — this mirrors how passwords are hashed, applied to
 * refresh tokens.
 */
export interface IRefreshTokenRepository {
  /** Persists a new refresh token, storing only its hash. */
  create(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;

  /** Looks up a refresh token by its hash. */
  findByHash(tokenHash: string): Promise<RefreshTokenSnapshot | null>;

  /** Deletes a single refresh token (used during rotation). */
  deleteById(id: string): Promise<void>;

  /** Deletes all refresh tokens for a user (logout-everywhere / revocation). */
  deleteAllForUser(userId: string): Promise<void>;
}

/** Injection token for {@link IRefreshTokenRepository} implementations. */
export const REFRESH_TOKEN_REPOSITORY = Symbol('REFRESH_TOKEN_REPOSITORY');
