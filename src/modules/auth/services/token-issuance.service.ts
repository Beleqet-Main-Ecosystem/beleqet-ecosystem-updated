import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'crypto';
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from '../interfaces/refresh-token-repository.interface';

/** Access tokens are short-lived by design — a stolen one expires fast. */
const ACCESS_TOKEN_TTL = '15m';

/** Refresh tokens live longer but are rotated on every use and revocable. */
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export interface TokenPair {
  readonly accessToken: string;
  readonly refreshToken: string;
}

/** JWT payload shape signed into every access token. */
export interface AccessTokenPayload {
  readonly sub: string;
}

/**
 * Issues and rotates the hybrid JWT (access) + DB-backed opaque
 * (refresh) token pair.
 *
 * ## Why hybrid instead of pure JWT
 *
 * A pure stateless JWT refresh token cannot be revoked before its
 * expiry — a stolen 30-day token stays valid for 30 days no matter what.
 * Storing only a SHA-256 hash of an opaque refresh token in the existing
 * `RefreshToken` table gives us real revocation (logout-everywhere,
 * kill-switch on a compromised token) while keeping the access token
 * itself stateless and cheap to verify on every request.
 */
@Injectable()
export class TokenIssuanceService {
  constructor(
    private readonly jwtService: JwtService,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepository: IRefreshTokenRepository,
  ) {}

  /**
   * Issues a brand-new access + refresh token pair for a user, e.g. after
   * a successful OAuth login/signup.
   */
  public async issueTokenPair(userId: string): Promise<TokenPair> {
    const accessToken = this.signAccessToken(userId);
    const refreshToken = await this.createAndStoreRefreshToken(userId);

    return { accessToken, refreshToken };
  }

  /**
   * Rotates a refresh token: validates it, deletes it, and issues a new
   * pair. Rotation on every use limits the blast radius of a leaked
   * refresh token to a single use before it's invalidated.
   *
   * @throws Error if the refresh token is unknown or expired.
   */
  public async rotateRefreshToken(presentedRefreshToken: string): Promise<TokenPair> {
    const tokenHash = this.hashToken(presentedRefreshToken);
    const stored = await this.refreshTokenRepository.findByHash(tokenHash);

    if (stored === null || stored.expiresAt.getTime() < Date.now()) {
      throw new Error('Refresh token is invalid or expired.');
    }

    await this.refreshTokenRepository.deleteById(stored.id);

    return this.issueTokenPair(stored.userId);
  }

  /** Revokes every refresh token for a user (logout-everywhere). */
  public async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.refreshTokenRepository.deleteAllForUser(userId);
  }

  private signAccessToken(userId: string): string {
    const payload: AccessTokenPayload = { sub: userId };
    return this.jwtService.sign(payload, { expiresIn: ACCESS_TOKEN_TTL });
  }

  private async createAndStoreRefreshToken(userId: string): Promise<string> {
    const rawToken = randomBytes(64).toString('hex');
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);

    await this.refreshTokenRepository.create(userId, tokenHash, expiresAt);

    return rawToken;
  }

  private hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
