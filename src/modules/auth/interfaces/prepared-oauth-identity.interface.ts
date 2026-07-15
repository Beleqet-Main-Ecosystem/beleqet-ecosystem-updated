import { OAuthProfile } from './oauth-profile.interface';

/**
 * What a Passport strategy hands back to the controller layer: a
 * normalized profile plus already-encrypted tokens. Deliberately contains
 * NO linking decision — strategies only prepare identity data; the
 * controller decides whether this is a fresh sign-in or an explicit
 * "confirm linking" action, since only the controller knows which route
 * was hit.
 */
export interface PreparedOAuthIdentity {
  readonly profile: OAuthProfile;
  readonly encryptedAccessToken: string;
  readonly encryptedRefreshToken?: string;
}
