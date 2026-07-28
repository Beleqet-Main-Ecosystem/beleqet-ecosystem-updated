import { Strategy } from 'passport-jwt';
import { AuthEnvConfig } from '../config/auth.config';
export interface AccessTokenPayload {
    readonly sub: string;
    readonly email: string;
    readonly role: string;
}
export interface AuthenticatedRequestUser {
    readonly userId: string;
    readonly email: string;
    readonly role: string;
}
declare const JwtStrategy_base: new (...args: any[]) => Strategy;
export declare class JwtStrategy extends JwtStrategy_base {
    constructor(config: AuthEnvConfig);
    validate(payload: AccessTokenPayload): AuthenticatedRequestUser;
}
export {};
