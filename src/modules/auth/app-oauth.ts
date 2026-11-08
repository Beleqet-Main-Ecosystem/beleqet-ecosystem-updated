import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Redis } from 'ioredis';
import { REDIS_CLIENT } from '../redis/redis.module';

/**
 * Google and LinkedIn sign-in for the mobile app, without tokens ever travelling in a link.
 *
 * The app keeps a random secret and starts the flow with its SHA-256 hash (`?app_challenge=`). When
 * the provider sends the browser back, the API keeps the new session's tokens for two minutes under
 * a one-time code and sends only that code to the app (beleqet://auth/callback?code=…). The app
 * trades the code plus the secret for the tokens. Another app that registered the beleqet:// scheme
 * and caught the redirect has the code but not the secret, so it gets nothing (the PKCE idea).
 */
export const APP_CALLBACK = 'beleqet://auth/callback';
const CHALLENGE = /^[A-Za-z0-9_-]{43}$/;
const KEY = (code: string) => `oauth-app:${code}`;
const TTL_SECONDS = 120;

type SessionRequest = { query?: Record<string, unknown>; session?: Record<string, unknown> };

/**
 * On the provider's start route: remember the app's challenge in the browser session (or forget a
 * stale one, so a later website sign-in in the same browser goes to the website).
 */
export function rememberAppChallenge(req: SessionRequest): void {
  if (!req.session) return;
  const query = req.query ?? {};
  // The callback carries ?code= or ?error=; only the start route sets or clears the challenge.
  if (query.code !== undefined || query.error !== undefined) return;
  const challenge = query.app_challenge;
  if (typeof challenge === 'string' && CHALLENGE.test(challenge))
    req.session.appChallenge = challenge;
  else delete req.session.appChallenge;
}

/** The app's challenge for this sign-in, removed from the session as it is read. */
export function takeAppChallenge(req: SessionRequest): string | null {
  const challenge = req.session?.appChallenge;
  if (req.session) delete req.session.appChallenge;
  return typeof challenge === 'string' && CHALLENGE.test(challenge) ? challenge : null;
}

@Injectable()
export class AppOAuthHandoff {
  constructor(@Inject(REDIS_CLIENT) private readonly redis: Redis) {}

  /** Holds the tokens for the app and returns the one-time code to send it. */
  async issue(
    challenge: string,
    tokens: { accessToken: string; refreshToken: string },
  ): Promise<string> {
    const code = randomBytes(32).toString('base64url');
    await this.redis.set(KEY(code), JSON.stringify({ challenge, ...tokens }), 'EX', TTL_SECONDS);
    return code;
  }

  /** Trades the code and the app's secret for the tokens, once. */
  async exchange(
    code: string,
    verifier: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    if (!/^[A-Za-z0-9_-]{20,100}$/.test(code) || !/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) {
      throw new UnauthorizedException('This sign-in has expired. Try again.');
    }
    // Read and delete in one step, so a code works only once.
    const raw = await this.redis.getdel(KEY(code));
    if (!raw) throw new UnauthorizedException('This sign-in has expired. Try again.');
    const held = JSON.parse(raw) as {
      challenge: string;
      accessToken: string;
      refreshToken: string;
    };
    const expected = Buffer.from(held.challenge);
    const actual = Buffer.from(createHash('sha256').update(verifier).digest('base64url'));
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new UnauthorizedException('This sign-in has expired. Try again.');
    }
    return { accessToken: held.accessToken, refreshToken: held.refreshToken };
  }
}
