import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AUTH_ENV_CONFIG } from '../config/auth.config';
import { AuthEnvConfig } from '../config/auth.config';
import { AccessTokenPayload } from '../services/token-issuance.service';

/** Shape attached to `req.user` for any route behind {@link JwtAuthGuard}. */
export interface AuthenticatedRequestUser {
  readonly userId: string;
}

/**
 * Validates the short-lived JWT access token issued by
 * `TokenIssuanceService` on every protected request. Stateless by
 * design — no DB lookup here; revocation is handled at the refresh-token
 * layer (see `TokenIssuanceService.revokeAllRefreshTokens`), so a
 * revoked user's *existing* access token remains valid for up to its
 * 15-minute TTL. This tradeoff (fast auth checks vs. instant revocation)
 * is standard for short-lived access tokens.
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
    return { userId: payload.sub };
  }
}
