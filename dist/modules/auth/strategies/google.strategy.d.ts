import { Strategy, Profile, VerifyCallback } from 'passport-google-oauth20';
import { ITokenCipher } from '../interfaces/token-cipher.interface';
import { PreparedOAuthIdentity } from '../interfaces/prepared-oauth-identity.interface';
import { AuthEnvConfig } from '../config/auth.config';
declare const GoogleStrategy_base: new (...args: any[]) => Strategy;
export declare class GoogleStrategy extends GoogleStrategy_base {
    private readonly tokenCipher;
    constructor(config: AuthEnvConfig, tokenCipher: ITokenCipher);
    validate(accessToken: string, refreshToken: string | undefined, profile: Profile, done: VerifyCallback): Promise<PreparedOAuthIdentity>;
}
export {};
