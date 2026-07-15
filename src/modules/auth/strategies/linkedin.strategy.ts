import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, StrategyOptions, Profile } from 'passport-openidconnect';
import { ITokenCipher, TOKEN_CIPHER } from '../interfaces/token-cipher.interface';
import { OAuthProvider } from '../interfaces/oauth-profile.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
import { AUTH_ENV_CONFIG, AuthEnvConfig } from '../config/auth.config';
import { prepareOAuthIdentity } from './prepare-oauth-identity.helper';

const LINKEDIN_OIDC_ISSUER = 'https://www.linkedin.com/oauth';
const LINKEDIN_AUTHORIZATION_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';

/**
 * Passport strategy for "Sign In with LinkedIn using OpenID Connect".
 * Uses the generic `passport-openidconnect` package configured against
 * LinkedIn's documented OIDC endpoints (see class doc in the original
 * design notes) rather than a LinkedIn-specific package.
 *
 * Only prepares the identity (normalize + encrypt tokens) — see
 * {@link PreparedOAuthIdentity}. Linking decisions live in the controller.
 */
@Injectable()
export class LinkedInStrategy extends PassportStrategy(Strategy, 'linkedin', true) {
  constructor(
    @Inject(AUTH_ENV_CONFIG) config: AuthEnvConfig,
    @Inject(TOKEN_CIPHER) private readonly tokenCipher: ITokenCipher,
  ) {
    const options: StrategyOptions = {
      issuer: LINKEDIN_OIDC_ISSUER,
      authorizationURL: LINKEDIN_AUTHORIZATION_URL,
      tokenURL: LINKEDIN_TOKEN_URL,
      userInfoURL: LINKEDIN_USERINFO_URL,
      clientID: config.linkedinClientId,
      clientSecret: config.linkedinClientSecret,
      callbackURL: config.linkedinCallbackUrl,
      scope: ['openid', 'profile', 'email'],
    };
    super(options);
  }

  public async validate(
    issuer: string,
    profile: Profile,
    context: unknown,
    idToken: string,
    accessToken: string,
    refreshToken: string | undefined,
  ): Promise<PreparedOAuthIdentity> {
    void issuer;
    void context;
    void idToken;

    const claims = profile._json ?? {};
    const email = profile.emails?.[0]?.value ?? claims.email;

    if (email === undefined) {
      throw new Error('LinkedIn profile did not include an email address.');
    }

    const normalizedProfile = {
      provider: OAuthProvider.LINKEDIN,
      providerAccountId: claims.sub ?? profile.id,
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
