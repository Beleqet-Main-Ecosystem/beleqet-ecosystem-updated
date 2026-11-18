/**
 * Environment validation for CI test runs and staging deployments.
 *
 * Used by the deploy workflow (via `ts-node tools/ci/environment-validator.ts`)
 * to fail fast — before any SSH connection or server mutation — when required
 * configuration is absent or malformed. Error messages name the offending
 * variable but never echo its value, so output is safe for CI logs.
 */

import type { ValidationMode, ValidationResult } from './types';

/** Variables the backend test suite needs (synthetic values are fine). */
const CI_TEST_VARIABLES: readonly string[] = [
  'DATABASE_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'JWT_ACCESS_SECRET',
  'SESSION_SECRET',
  'TOTP_ENCRYPTION_KEY',
  'TOTP_TEMP_SECRET',
];

/** Variables a real staging deployment needs before any remote action. */
const STAGING_VARIABLES: readonly string[] = [
  'STAGING_HOST',
  'STAGING_PORT',
  'STAGING_USER',
  'STAGING_DEPLOY_PATH',
  'STAGING_BACKEND_HEALTH_URL',
  'STAGING_ADMIN_HEALTH_URL',
  'STAGING_JOBS_HEALTH_URL',
  'STAGING_GHCR_USERNAME',
  'STAGING_GHCR_TOKEN',
];

/** Variables treated as secrets: placeholder detection applies in deploy mode. */
const STAGING_SECRET_VARIABLES: readonly string[] = ['STAGING_GHCR_TOKEN'];

/**
 * Values that indicate a template was copied without filling in real secrets.
 * Matched case-insensitively as substrings.
 */
const PLACEHOLDER_MARKERS: readonly string[] = [
  'replace_with',
  'changeme',
  'change_me',
  'your_password',
  'your_token',
  'placeholder',
  'dummy',
  'example',
  'xxxx',
];

/** True when the value looks like an unfilled template placeholder. */
export function isPlaceholderSecret(value: string): boolean {
  const lowered = value.toLowerCase();
  return PLACEHOLDER_MARKERS.some((marker) => lowered.includes(marker));
}

/** True when the value parses as a TCP port (1–65535, digits only). */
export function isValidPort(value: string): boolean {
  if (!/^\d{1,5}$/.test(value)) {
    return false;
  }
  const port = Number(value);
  return port >= 1 && port <= 65535;
}

/** True when the value is an absolute http(s) URL. */
export function isValidHttpUrl(value: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }
  return parsed.protocol === 'http:' || parsed.protocol === 'https:';
}

/**
 * Validate an environment snapshot for the given mode.
 *
 * `ci-test` enforces the variables the backend test suite reads;
 * `staging-deploy` enforces the full staging variable set, port/URL syntax,
 * and rejects placeholder values in secret variables.
 *
 * @param env  Environment snapshot (e.g. `process.env`). Values may be absent.
 * @param mode Which variable set to enforce.
 */
export function validateEnvironment(
  env: Readonly<Record<string, string | undefined>>,
  mode: ValidationMode,
): ValidationResult {
  const errors: string[] = [];
  const required = mode === 'staging-deploy' ? STAGING_VARIABLES : CI_TEST_VARIABLES;

  for (const name of required) {
    const value = env[name];
    if (value === undefined || value.trim() === '') {
      errors.push(`Missing required variable: ${name}`);
    }
  }

  if (mode === 'staging-deploy') {
    const port = env.STAGING_PORT;
    if (port !== undefined && port.trim() !== '' && !isValidPort(port)) {
      errors.push('Invalid value for STAGING_PORT: must be a TCP port between 1 and 65535');
    }

    for (const name of [
      'STAGING_BACKEND_HEALTH_URL',
      'STAGING_ADMIN_HEALTH_URL',
      'STAGING_JOBS_HEALTH_URL',
    ]) {
      const value = env[name];
      if (value !== undefined && value.trim() !== '' && !isValidHttpUrl(value)) {
        errors.push(`Invalid value for ${name}: must be an absolute http(s) URL`);
      }
    }

    for (const name of STAGING_SECRET_VARIABLES) {
      const value = env[name];
      if (value !== undefined && value.trim() !== '' && isPlaceholderSecret(value)) {
        errors.push(`Refusing to deploy: ${name} looks like an unfilled placeholder`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

/* istanbul ignore next — thin CLI wrapper; logic above is fully unit-tested. */
if (require.main === module) {
  const modeArg = process.argv[2];
  if (modeArg !== 'ci-test' && modeArg !== 'staging-deploy') {
    process.stderr.write('Usage: environment-validator.ts <ci-test|staging-deploy>\n');
    process.exit(2);
  }
  const result = validateEnvironment(process.env, modeArg);
  if (!result.valid) {
    for (const error of result.errors) {
      process.stderr.write(`${error}\n`);
    }
    process.exit(1);
  }
  process.stdout.write(`Environment OK for mode: ${modeArg}\n`);
}
