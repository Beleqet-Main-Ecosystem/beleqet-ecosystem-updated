"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AUTH_ENV_CONFIG = exports.TOKEN_ENCRYPTION_KEY = void 0;
exports.loadAuthEnvConfig = loadAuthEnvConfig;
const REQUIRED_KEY_LENGTH_BYTES = 32;
exports.TOKEN_ENCRYPTION_KEY = Symbol('TOKEN_ENCRYPTION_KEY');
exports.AUTH_ENV_CONFIG = Symbol('AUTH_ENV_CONFIG');
function requireEnv(name) {
    const value = process.env[name];
    if (value === undefined || value.trim().length === 0) {
        throw new Error(`Missing required environment variable "${name}". Refusing to start ` +
            'the auth module without it — see .env.example for the full list.');
    }
    return value;
}
function loadAuthEnvConfig() {
    const encodedKey = requireEnv('OAUTH_TOKEN_ENCRYPTION_KEY');
    const tokenEncryptionKey = Buffer.from(encodedKey, 'base64');
    if (tokenEncryptionKey.length !== REQUIRED_KEY_LENGTH_BYTES) {
        throw new Error(`OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly ${REQUIRED_KEY_LENGTH_BYTES} ` +
            `bytes for AES-256-GCM, but got ${tokenEncryptionKey.length} bytes. ` +
            'Generate one with: openssl rand -base64 32');
    }
    return {
        googleClientId: requireEnv('GOOGLE_CLIENT_ID'),
        googleClientSecret: requireEnv('GOOGLE_CLIENT_SECRET'),
        googleCallbackUrl: requireEnv('GOOGLE_CALLBACK_URL'),
        linkedinClientId: requireEnv('LINKEDIN_CLIENT_ID'),
        linkedinClientSecret: requireEnv('LINKEDIN_CLIENT_SECRET'),
        linkedinCallbackUrl: requireEnv('LINKEDIN_CALLBACK_URL'),
        jwtAccessSecret: requireEnv('JWT_ACCESS_SECRET'),
        appBaseUrl: requireEnv('APP_BASE_URL'),
        sessionSecret: requireEnv('SESSION_SECRET'),
        tokenEncryptionKey,
    };
}
//# sourceMappingURL=auth.config.js.map