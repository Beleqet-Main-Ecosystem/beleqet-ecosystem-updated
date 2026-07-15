import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';

/** Info shape Passport provides when authentication fails. */
interface AuthFailureInfo {
  readonly message?: string;
}

/**
 * Activates the `linkedin` Passport strategy for a route. Applying this
 * guard to `GET /auth/linkedin` redirects the user to LinkedIn's consent
 * screen; applying it to `GET /auth/linkedin/callback` completes the
 * flow and populates `req.user` with the {@link PreparedOAuthIdentity}
 * returned by `LinkedInStrategy.validate`.
 */
@Injectable()
export class LinkedInAuthGuard extends AuthGuard('linkedin') {
  /**
   * Surfaces the real Passport failure reason (e.g. issuer mismatch,
   * state verification failure) as the thrown error's message, instead
   * of the framework's generic "Unauthorized" — this was essential for
   * diagnosing the LinkedIn OIDC integration issues during development
   * and remains valuable for any future auth failures in production logs.
   */
  public handleRequest<TUser = PreparedOAuthIdentity>(
    err: Error | null,
    user: TUser | false,
    info: AuthFailureInfo | undefined,
  ): TUser {
    if (err || !user) {
      throw err ?? new Error(info?.message ?? 'LinkedIn authentication failed.');
    }
    return user;
  }
}
