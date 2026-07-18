import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_ENV_CONFIG, AuthEnvConfig } from '../config/auth.config';

/**
 * JWT payload shape signed into every access token by
 * `AuthService.issueTokens` (defined here, not imported, since the
 * OAuth module's own separate token-issuance service was removed in
 * favor of reusing AuthService as the single token-issuance path).
 */
export interface AccessTokenPayload {
  readonly sub: string;
  readonly email?: string;
  readonly role?: string;
}

/**
 * Shape attached to `req.user` for any route behind {@link JwtAuthGuard}.
 *
 * FIX: previously only `userId` was returned here, silently dropping
 * `email`/`role` even though both are present in the signed JWT payload
 * and `CurrentUserPayload` (common/decorators/current-user.decorator.ts)
 * already declares them as required. This meant every `@Roles('ADMIN')`
 * check across the app (dispute-manager, admin-stats, etc.) was
 * comparing against `undefined` and silently failing — discovered while
 * verifying the new Audit Trail module's admin-only endpoint.
 */
export interface AuthenticatedRequestUser {
  readonly userId: string;
  readonly email?: string;
  readonly role?: string;
}

/**
 * Validates the short-lived JWT access token issued by
 * `AuthService.issueTokens` / `issueTokensForUserId` on every protected
 * request. Stateless by design — no DB lookup here.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(@Inject(AUTH_ENV_CONFIG) config: AuthEnvConfig) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.jwtAccessSecret,
    });
  }

  /** Passport calls this after signature + expiry verification succeeds. */
  public validate(payload: AccessTokenPayload): AuthenticatedRequestUser {
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
