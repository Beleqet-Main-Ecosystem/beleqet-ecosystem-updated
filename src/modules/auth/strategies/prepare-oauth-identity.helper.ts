import { ITokenCipher } from '../interfaces/token-cipher.interface';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';

/**
 * Encrypts the raw provider tokens and bundles them with the normalized
 * profile. Contains no linking logic — see {@link PreparedOAuthIdentity}.
 */
export function prepareOAuthIdentity(
  profile: OAuthProfile,
  tokenCipher: ITokenCipher,
): PreparedOAuthIdentity {
  return {
    profile,
    encryptedAccessToken: tokenCipher.encrypt(profile.rawAccessToken),
    encryptedRefreshToken: profile.rawRefreshToken
      ? tokenCipher.encrypt(profile.rawRefreshToken)
      : undefined,
  };
}
