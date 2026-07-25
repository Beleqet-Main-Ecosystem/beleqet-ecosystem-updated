import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ITokenCipher, TOKEN_CIPHER } from '../interfaces/token-cipher.interface';
import { OAuthProvider } from '../interfaces/oauth-profile.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
import { AUTH_ENV_CONFIG, AuthEnvConfig } from '../config/auth.config';
import { prepareOAuthIdentity } from './prepare-oauth-identity.helper';

/**
 * Google's raw userinfo claims relevant to us, as found on
 * `profile._json` when the `profile` scope requests standard OIDC claims.
 *
 * keep this file free of implicit/explicit `any`.
 */
interface GoogleRawProfileClaims {
  readonly email?: string;
  readonly email_verified?: boolean;
  readonly given_name?: string;
  readonly family_name?: string;
  readonly picture?: string;
}

/**
 * Passport strategy for "Sign in with Google" (OAuth 2.0 + OIDC).
 *
 * ## Responsibility boundary
 *
 * This class ONLY translates Google's transport-specific profile shape
 * into our normalized {@link OAuthProfile} and hands off to
 * {@link processOAuthProfile}. It contains no linking/hijack-prevention
 * logic itself, no DB access, and no token persistence — all of that
 * lives in {@link AccountLinkingService} and {@link TokenEncryptionService}.
 * This separation is what keeps the strategy layer thin and swappable.
 *
 * @remarks
 * Requires: `npm install passport-google-oauth20` and
 * `npm install -D @types/passport-google-oauth20`.
 */
@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    @Inject(AUTH_ENV_CONFIG) config: AuthEnvConfig,
    @Inject(TOKEN_CIPHER) private readonly tokenCipher: ITokenCipher,
  ) {
    const options: StrategyOptions = {
      clientID: config.googleClientId,
      clientSecret: config.googleClientSecret,
      callbackURL: config.googleCallbackUrl,
      scope: ['email', 'profile'],
    };
    super(options);
  }

  /**
   * Invoked by Passport once Google redirects back with a successful
   * authorization. Maps Google's profile into {@link OAuthProfile} and
   * delegates the linking decision to {@link AccountLinkingService}.
   *
   * @param accessToken - Google OAuth2 access token (raw, encrypted
   *   before any persistence — never logged or stored as-is).
   * @param refreshToken - Refresh token, present only if `access_type:
   *   offline` was requested during authorization.
   * @param profile - Google's normalized Passport profile.
   * @param done - Passport's verify callback. Not used directly here;
   *   `@nestjs/passport` allows `validate()` to return the resolved value
   *   or throw instead, and wires it to `done` automatically.
   * @returns The {@link OAuthSignInOutcome}, attached by NestJS to
   *   `req.user` for the controller layer to act on.
   */
  public async validate(
    accessToken: string,
    refreshToken: string | undefined,
    profile: Profile,
    done: VerifyCallback,
  ): Promise<PreparedOAuthIdentity> {
    const claims = (profile._json ?? {}) as GoogleRawProfileClaims;
    const email = profile.emails?.[0]?.value ?? claims.email;

    if (email === undefined) {
      throw new Error('Google profile did not include an email address.');
    }

    void done; // intentionally unused — see method doc.

    const normalizedProfile = {
      provider: OAuthProvider.GOOGLE,
      providerAccountId: profile.id,
      email,
      emailVerified: claims.email_verified === true,
      firstName: profile.name?.givenName ?? claims.given_name ?? '',
      lastName: profile.name?.familyName ?? claims.family_name ?? '',
      avatarUrl: profile.photos?.[0]?.value ?? claims.picture,
      rawAccessToken: accessToken,
      rawRefreshToken: refreshToken,
    };

    return prepareOAuthIdentity(normalizedProfile, this.tokenCipher);
  }
}
