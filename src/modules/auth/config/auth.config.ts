/**
 * Required byte length of the token-encryption key: AES-256 requires a
 * 256-bit (32-byte) key.
 */
const REQUIRED_KEY_LENGTH_BYTES = 32;

/**
 * Injection token for the raw AES-256-GCM key `Buffer`, provided via a
 * factory provider in `auth.module.ts` (derived from {@link loadAuthEnvConfig}).
 * Keeping this as its own injectable value — rather than having
 * `TokenEncryptionService` read `process.env` itself — keeps config
 * loading and encryption logic as separate, independently testable
 * responsibilities (Single Responsibility Principle).
 */
export const TOKEN_ENCRYPTION_KEY = Symbol('TOKEN_ENCRYPTION_KEY');
export const AUTH_ENV_CONFIG = Symbol('AUTH_ENV_CONFIG');

/**
 * Strongly-typed shape of the environment configuration this module reads.
 * Every value originates from `process.env` — nothing here is ever
 * hardcoded, satisfying the "no secrets in code" requirement.
 */
export interface AuthEnvConfig {
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly googleCallbackUrl: string;
  readonly linkedinClientId: string;
  readonly linkedinClientSecret: string;
  readonly linkedinCallbackUrl: string;
  /** Secret used to sign short-lived JWT access tokens. */
  readonly jwtAccessSecret: string;
  /** Base URL of this API, used to build emailed confirmation links. */
  readonly appBaseUrl: string;
  /** Secret for express-session, used only as transient CSRF-state storage during the LinkedIn OIDC handshake. */
  readonly sessionSecret: string;
  /** Raw 32-byte AES-256-GCM key, decoded from the base64 env value. */
  readonly tokenEncryptionKey: Buffer;
}

/**
 * Reads a required environment variable or throws a descriptive error.
 * Failing fast at startup (rather than at first use, mid-request) is
 * deliberate: a missing OAuth secret should crash the app on boot, not
 * surface as a confusing 500 error to the first user who tries to log in.
 */
function requireEnv(name: string): string {
  const value = process.env[name];

  if (value === undefined || value.trim().length === 0) {
    throw new Error(
      `Missing required environment variable "${name}". Refusing to start ` +
        'the auth module without it — see .env.example for the full list.',
    );
  }

  return value;
}

/**
 * Loads and validates all environment configuration required by the
 * Social Logins module. Intended to be called once at application
 * bootstrap (e.g. inside `AuthModule`'s provider factory), not per-request.
 *
 * @throws Error if any required variable is missing, or if
 *   `OAUTH_TOKEN_ENCRYPTION_KEY` does not decode to exactly 32 bytes.
 */
export function loadAuthEnvConfig(): AuthEnvConfig {
  const encodedKey = requireEnv('OAUTH_TOKEN_ENCRYPTION_KEY');
  const tokenEncryptionKey = Buffer.from(encodedKey, 'base64');

  if (tokenEncryptionKey.length !== REQUIRED_KEY_LENGTH_BYTES) {
    throw new Error(
      `OAUTH_TOKEN_ENCRYPTION_KEY must decode to exactly ${REQUIRED_KEY_LENGTH_BYTES} ` +
        `bytes for AES-256-GCM, but got ${tokenEncryptionKey.length} bytes. ` +
        'Generate one with: openssl rand -base64 32',
    );
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
