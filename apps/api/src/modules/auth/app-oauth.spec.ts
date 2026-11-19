import { createHash } from 'crypto';
import { UnauthorizedException } from '@nestjs/common';
import { AppOAuthHandoff, rememberAppChallenge, takeAppChallenge } from './app-oauth';

const verifier = 'a'.repeat(64);
const challenge = createHash('sha256').update(verifier).digest('base64url');

describe('app sign-in handoff', () => {
  const store = new Map<string, string>();
  const redis = {
    set: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
      return 'OK';
    }),
    getdel: jest.fn(async (key: string) => {
      const value = store.get(key) ?? null;
      store.delete(key);
      return value;
    }),
  };
  const handoff = new AppOAuthHandoff(redis as never);
  const tokens = { accessToken: 'access', refreshToken: 'refresh' };

  beforeEach(() => store.clear());

  it('gives the tokens to the app that holds the secret, once', async () => {
    const code = await handoff.issue(challenge, tokens);
    expect(redis.set).toHaveBeenCalledWith(`oauth-app:${code}`, expect.any(String), 'EX', 120);
    await expect(handoff.exchange(code, verifier)).resolves.toEqual(tokens);
    await expect(handoff.exchange(code, verifier)).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('gives nothing to someone who caught the code but has no secret', async () => {
    const code = await handoff.issue(challenge, tokens);
    await expect(handoff.exchange(code, 'b'.repeat(64))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('remembers a challenge only on the start route, and forgets a stale one', () => {
    const req = { query: { app_challenge: challenge }, session: {} as Record<string, unknown> };
    rememberAppChallenge(req);
    expect(req.session.appChallenge).toBe(challenge);

    // The provider's callback (?code=) leaves it for the controller to take.
    rememberAppChallenge({ query: { code: 'x' }, session: req.session });
    expect(req.session.appChallenge).toBe(challenge);

    // A website sign-in started later in the same browser clears it.
    rememberAppChallenge({ query: {}, session: req.session });
    expect(req.session.appChallenge).toBeUndefined();
  });

  it('ignores a malformed challenge and reads a good one only once', () => {
    const session: Record<string, unknown> = {};
    rememberAppChallenge({ query: { app_challenge: 'not-a-hash' }, session });
    expect(takeAppChallenge({ session })).toBeNull();

    rememberAppChallenge({ query: { app_challenge: challenge }, session });
    expect(takeAppChallenge({ session })).toBe(challenge);
    expect(takeAppChallenge({ session })).toBeNull();
  });
});
