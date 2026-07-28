import { Strategy, Profile } from 'passport-openidconnect';
import { ITokenCipher } from '../interfaces/token-cipher.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
import { AuthEnvConfig } from '../config/auth.config';
declare const LinkedInStrategy_base: new (...args: any[]) => Strategy;
export declare class LinkedInStrategy extends LinkedInStrategy_base {
    private readonly tokenCipher;
    constructor(config: AuthEnvConfig, tokenCipher: ITokenCipher);
    validate(issuer: string, profile: Profile, context: unknown, idToken: string, accessToken: string, refreshToken: string | undefined): Promise<PreparedOAuthIdentity>;
}
export {};
