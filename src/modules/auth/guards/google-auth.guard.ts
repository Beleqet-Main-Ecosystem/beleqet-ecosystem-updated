import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Activates the `google` Passport strategy for a route. Applying this
 * guard to `GET /auth/google` redirects the user to Google's consent
 * screen; applying it to `GET /auth/google/callback` completes the
 * flow and populates `req.user` with the `PreparedOAuthIdentity`
 * returned by `GoogleStrategy.validate`.
 *
 * `state: true` enables Passport's session-backed CSRF state parameter:
 * a random value is generated and stored in the session when the flow
 * starts, then verified against what Google echoes back on callback.
 * Without this, an attacker could craft a forged callback URL and force
 * a victim's browser to complete an OAuth flow initiated by the
 * attacker — a login CSRF attack. Requires `express-session` to already
 * be configured (it is, for the LinkedIn OIDC flow).
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  public getAuthenticateOptions(_context: ExecutionContext): { state: boolean } {
    return { state: true };
  }
}
