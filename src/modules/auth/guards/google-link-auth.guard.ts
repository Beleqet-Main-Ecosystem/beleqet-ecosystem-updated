import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request } from 'express';

/**
 * Used on `GET /auth/google/link?token=...` to re-authenticate with
 * Google as proof of continued account control, while carrying the
 * pending-link confirmation token through the OAuth round-trip via the
 * `state` parameter (no session required — `state` here is an opaque
 * passthrough value, not session-backed CSRF state).
 *
 * The shared `/auth/google/callback` route reads `req.query.state` back
 * to detect "this is a link confirmation" vs. a normal sign-in.
 */
@Injectable()
export class GoogleLinkAuthGuard extends AuthGuard('google') {
  public getAuthenticateOptions(context: ExecutionContext): { state: string } {
    const request = context.switchToHttp().getRequest<Request>();
    const token = request.query.token;

    if (typeof token !== 'string' || token.length === 0) {
      throw new Error('Missing required "token" query parameter for link confirmation.');
    }

    return { state: `link:${token}` };
  }
}
