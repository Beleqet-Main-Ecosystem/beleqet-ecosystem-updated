import { OAuthProfile } from './oauth-profile.interface';
export interface PreparedOAuthIdentity {
    readonly profile: OAuthProfile;
    readonly encryptedAccessToken: string;
    readonly encryptedRefreshToken?: string;
}
