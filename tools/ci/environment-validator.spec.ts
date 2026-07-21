import {
  isPlaceholderSecret,
  isValidHttpUrl,
  isValidPort,
  validateEnvironment,
} from './environment-validator';

/** A complete, well-formed staging environment used as the mutation baseline. */
function validStagingEnv(): Record<string, string> {
  return {
    STAGING_HOST: 'staging.internal.test',
    STAGING_PORT: '22',
    STAGING_USER: 'deploy',
    STAGING_DEPLOY_PATH: '/srv/beleqet-staging',
    STAGING_BACKEND_HEALTH_URL: 'https://staging.internal.test/api/v1/health/ready',
    STAGING_ADMIN_HEALTH_URL: 'https://admin.staging.internal.test/',
    STAGING_JOBS_HEALTH_URL: 'https://jobs.staging.internal.test/',
    STAGING_GHCR_USERNAME: 'nathnaelmesfin',
    STAGING_GHCR_TOKEN: 'ghp_synthetic_token_value_1234567890abcd',
  };
}

function validCiTestEnv(): Record<string, string> {
  return {
    DATABASE_URL: 'postgresql://postgres:postgres@127.0.0.1:5432/beleqet_test',
    REDIS_HOST: '127.0.0.1',
    REDIS_PORT: '6379',
    JWT_ACCESS_SECRET: 'ci_test_jwt_secret',
    SESSION_SECRET: 'ci_test_session_secret',
    TOTP_ENCRYPTION_KEY: 'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789',
    TOTP_TEMP_SECRET: 'ci_test_totp_secret',
  };
}

describe('validateEnvironment (staging-deploy)', () => {
  it('accepts a complete staging variable set', () => {
    const result = validateEnvironment(validStagingEnv(), 'staging-deploy');
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a missing staging host', () => {
    const env = validStagingEnv();
    delete env.STAGING_HOST;
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required variable: STAGING_HOST');
  });

  it('rejects a missing deployment path', () => {
    const env = validStagingEnv();
    delete env.STAGING_DEPLOY_PATH;
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required variable: STAGING_DEPLOY_PATH');
  });

  it('treats a whitespace-only value as missing', () => {
    const env = validStagingEnv();
    env.STAGING_USER = '   ';
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Missing required variable: STAGING_USER');
  });

  it.each(['0', '65536', 'twenty-two', '22; rm -rf /', ''])(
    'rejects invalid staging port %j',
    (port) => {
      const env = validStagingEnv();
      env.STAGING_PORT = port;
      const result = validateEnvironment(env, 'staging-deploy');
      expect(result.valid).toBe(false);
    },
  );

  it('rejects an invalid health-check URL', () => {
    const env = validStagingEnv();
    env.STAGING_BACKEND_HEALTH_URL = 'not a url';
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Invalid value for STAGING_BACKEND_HEALTH_URL: must be an absolute http(s) URL',
    );
  });

  it('rejects a non-http(s) health-check URL', () => {
    const env = validStagingEnv();
    env.STAGING_JOBS_HEALTH_URL = 'ftp://jobs.staging.internal.test/';
    expect(validateEnvironment(env, 'staging-deploy').valid).toBe(false);
  });

  it('rejects placeholder secrets in deployment mode', () => {
    const env = validStagingEnv();
    env.STAGING_GHCR_TOKEN = 'REPLACE_WITH_YOUR_TOKEN';
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      'Refusing to deploy: STAGING_GHCR_TOKEN looks like an unfilled placeholder',
    );
  });

  it('never prints secret values in errors', () => {
    const secret = 'super-secret-dummy-material-abc123';
    const env = validStagingEnv();
    env.STAGING_GHCR_TOKEN = secret; // contains "dummy" → placeholder rejection
    env.STAGING_PORT = 'not-a-port';
    const result = validateEnvironment(env, 'staging-deploy');
    expect(result.valid).toBe(false);
    for (const error of result.errors) {
      expect(error).not.toContain(secret);
      expect(error).not.toContain('abc123');
    }
  });
});

describe('validateEnvironment (ci-test)', () => {
  it('accepts the CI test variable set', () => {
    const result = validateEnvironment(validCiTestEnv(), 'ci-test');
    expect(result.valid).toBe(true);
  });

  it('differentiates CI test variables from staging variables', () => {
    // A full staging env is NOT sufficient for the CI test mode, and a full
    // CI test env is NOT sufficient for staging — the sets are independent.
    expect(validateEnvironment(validStagingEnv(), 'ci-test').valid).toBe(false);
    expect(validateEnvironment(validCiTestEnv(), 'staging-deploy').valid).toBe(false);
  });

  it('does not apply staging URL rules in ci-test mode', () => {
    const env = validCiTestEnv();
    env.STAGING_BACKEND_HEALTH_URL = 'not a url'; // irrelevant in this mode
    expect(validateEnvironment(env, 'ci-test').valid).toBe(true);
  });
});

describe('isValidPort', () => {
  it.each(['1', '22', '65535'])('accepts %s', (port) => {
    expect(isValidPort(port)).toBe(true);
  });
  it.each(['0', '65536', '-1', '2.2', 'abc', ' 22', ''])('rejects %j', (port) => {
    expect(isValidPort(port)).toBe(false);
  });
});

describe('isValidHttpUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isValidHttpUrl('http://localhost:4000/api/v1/health')).toBe(true);
    expect(isValidHttpUrl('https://staging.example.test/')).toBe(true);
  });
  it('rejects other schemes and garbage', () => {
    expect(isValidHttpUrl('ftp://example.test')).toBe(false);
    expect(isValidHttpUrl('file:///etc/passwd')).toBe(false);
    expect(isValidHttpUrl('//missing-scheme')).toBe(false);
    expect(isValidHttpUrl('')).toBe(false);
  });
});

describe('isPlaceholderSecret', () => {
  it('flags template markers case-insensitively', () => {
    expect(isPlaceholderSecret('CHANGEME')).toBe(true);
    expect(isPlaceholderSecret('your_password')).toBe(true);
    expect(isPlaceholderSecret('Replace_With_real_value')).toBe(true);
  });
  it('accepts realistic secret material', () => {
    expect(isPlaceholderSecret('ghp_9f8e7d6c5b4a39281706f5e4d3c2b1a09876')).toBe(false);
  });
});
