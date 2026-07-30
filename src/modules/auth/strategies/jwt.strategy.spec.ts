import { UnauthorizedException } from '@nestjs/common';
import { AuthEnvConfig } from '../config/auth.config';
import { JwtStrategy } from './jwt.strategy';

/** Configuration fixture used to construct the JWT strategy in isolation. */
const authConfig: AuthEnvConfig = {
  googleClientId: 'test-google-client',
  googleClientSecret: 'test-google-secret',
  googleCallbackUrl: 'http://localhost:4000/api/v1/auth/google/callback',
  linkedinClientId: 'test-linkedin-client',
  linkedinClientSecret: 'test-linkedin-secret',
  linkedinCallbackUrl: 'http://localhost:4000/api/v1/auth/linkedin/callback',
  jwtAccessSecret: 'test-jwt-secret',
  appBaseUrl: 'http://localhost:3000',
  sessionSecret: 'test-session-secret',
  tokenEncryptionKey: Buffer.alloc(32),
};

describe('JwtStrategy', () => {
  /** Validates the access-token claims forwarded to protected routes. */
  it('forwards the user identity and role claims to request handlers', () => {
    const strategy = new JwtStrategy(authConfig);

    expect(
      strategy.validate({ sub: 'user-1', email: 'admin@example.test', role: 'ADMIN' }),
    ).toEqual({ userId: 'user-1', email: 'admin@example.test', role: 'ADMIN' });
  });

  /** Rejects malformed tokens before a controller or role guard receives them. */
  it('rejects an access token without its required authorization claims', () => {
    const strategy = new JwtStrategy(authConfig);

    expect(() =>
      strategy.validate({ sub: 'user-1', email: 'admin@example.test', role: '' }),
    ).toThrow(UnauthorizedException);
  });
});
