/**
 * Integration tests for docker-compose.staging.yml rendering.
 *
 * Uses the REAL `docker compose config` renderer (no mocks): the required-
 * variable guards (`${VAR:?}`) are a deployment safety contract, so they are
 * verified against the actual tool that enforces them. Skipped automatically
 * when no docker CLI is available.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const COMPOSE_FILE = path.join(REPO_ROOT, 'docker-compose.staging.yml');

const FULL_ENV = [
  'STAGING_DB_USER=synthetic_user',
  'STAGING_DB_PASSWORD=synthetic_password',
  'STAGING_DB_NAME=synthetic_db',
  'STAGING_FRONTEND_URLS=http://localhost:3000',
  'STAGING_APP_BASE_URL=http://localhost:4000',
  'JWT_ACCESS_SECRET=synthetic_jwt',
  'SESSION_SECRET=synthetic_session',
  'TOTP_ENCRYPTION_KEY=synthetic_totp',
  'TOTP_TEMP_SECRET=synthetic_totp_temp',
  'OAUTH_TOKEN_ENCRYPTION_KEY=VGVzdEVuY3J5cHRpb25LZXkzMkJ5dGVzTG9uZ1hZWjE=',
  'GOOGLE_CLIENT_ID=synthetic_google_client_id',
  'GOOGLE_CLIENT_SECRET=synthetic_google_client_secret',
  'GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback',
  'LINKEDIN_CLIENT_ID=synthetic_linkedin_client_id',
  'LINKEDIN_CLIENT_SECRET=synthetic_linkedin_client_secret',
  'LINKEDIN_CALLBACK_URL=http://localhost:4000/api/v1/auth/linkedin/callback',
  'SMTP_HOST=localhost',
  'SMTP_USER=synthetic_smtp_user',
  'SMTP_PASSWORD=synthetic_smtp_password',
  'SMTP_FROM_ADDRESS=noreply@example.test',
  'STRIPE_SECRET_KEY=sk_test_synthetic',
  'STRIPE_WEBHOOK_SECRET=whsec_synthetic',
  'PAYPAL_CLIENT_ID=synthetic_paypal_client_id',
  'PAYPAL_CLIENT_SECRET=synthetic_paypal_client_secret',
].join('\n');

const IMAGES_ENV = [
  `BACKEND_IMAGE=ghcr.io/example/beleqet-backend:${'0'.repeat(40)}`,
  `ADMIN_IMAGE=ghcr.io/example/beleqet-admin-frontend:${'0'.repeat(40)}`,
  `JOBS_IMAGE=ghcr.io/example/beleqet-jobs-frontend:${'0'.repeat(40)}`,
].join('\n');

function dockerAvailable(): boolean {
  const probe = spawnSync('docker', ['compose', 'version'], { encoding: 'utf8', timeout: 30_000 });
  return probe.status === 0;
}

interface RenderResult {
  readonly status: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

function renderCompose(envFiles: readonly string[]): RenderResult {
  const args = [
    'compose',
    ...envFiles.flatMap((f) => ['--env-file', f]),
    '-f',
    COMPOSE_FILE,
    'config',
  ];
  const result = spawnSync('docker', args, {
    encoding: 'utf8',
    timeout: 60_000,
    // Neutral cwd so a developer's local .env can never leak into the render.
    cwd: os.tmpdir(),
  });
  return { status: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

jest.setTimeout(120_000);

const describeIfDocker = dockerAvailable() ? describe : describe.skip;

describeIfDocker('docker-compose.staging.yml rendering', () => {
  let tmpDir: string;
  let fullEnvFile: string;
  let imagesEnvFile: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'beleqet-compose-test-'));
    fullEnvFile = path.join(tmpDir, 'env.staging');
    imagesEnvFile = path.join(tmpDir, 'env.images');
    fs.writeFileSync(fullEnvFile, `${FULL_ENV}\n`);
    fs.writeFileSync(imagesEnvFile, `${IMAGES_ENV}\n`);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('renders with a valid synthetic environment', () => {
    const result = renderCompose([fullEnvFile, imagesEnvFile]);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('beleqet-backend');
    expect(result.stdout).toContain('beleqet-admin-frontend');
    expect(result.stdout).toContain('beleqet-jobs-frontend');
    // All three app services carry health checks.
    expect(result.stdout.match(/healthcheck:/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('refuses to render when a required secret variable is absent', () => {
    const partial = path.join(tmpDir, 'env.partial');
    fs.writeFileSync(
      partial,
      `${FULL_ENV.split('\n')
        .filter((line) => !line.startsWith('JWT_ACCESS_SECRET='))
        .join('\n')}\n`,
    );
    const result = renderCompose([partial, imagesEnvFile]);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('JWT_ACCESS_SECRET');
  });

  it('refuses to render when the image references are absent', () => {
    const result = renderCompose([fullEnvFile]);
    expect(result.status).not.toBe(0);
    expect(`${result.stderr}`).toMatch(/BACKEND_IMAGE|ADMIN_IMAGE|JOBS_IMAGE/);
  });

  it('contains no hard-coded credentials in the template', () => {
    const template = fs.readFileSync(COMPOSE_FILE, 'utf8');
    expect(template).not.toMatch(/password\s*[:=]\s*['"]?[a-z0-9]{4,}/i);
    expect(template).not.toContain('your_password');
    expect(template).not.toContain('please_change');
  });
});
