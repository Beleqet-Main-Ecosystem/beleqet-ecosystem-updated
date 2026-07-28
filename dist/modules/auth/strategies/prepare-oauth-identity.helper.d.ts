import { ITokenCipher } from '../interfaces/token-cipher.interface';
import { OAuthProfile } from '../interfaces/oauth-profile.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
export declare function prepareOAuthIdentity(profile: OAuthProfile, tokenCipher: ITokenCipher): PreparedOAuthIdentity;
