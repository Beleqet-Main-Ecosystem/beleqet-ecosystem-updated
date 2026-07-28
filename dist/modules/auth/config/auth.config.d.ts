export declare const TOKEN_ENCRYPTION_KEY: unique symbol;
export declare const AUTH_ENV_CONFIG: unique symbol;
export interface AuthEnvConfig {
    readonly googleClientId: string;
    readonly googleClientSecret: string;
    readonly googleCallbackUrl: string;
    readonly linkedinClientId: string;
    readonly linkedinClientSecret: string;
    readonly linkedinCallbackUrl: string;
    readonly jwtAccessSecret: string;
    readonly appBaseUrl: string;
    readonly sessionSecret: string;
    readonly tokenEncryptionKey: Buffer;
}
export declare function loadAuthEnvConfig(): AuthEnvConfig;
