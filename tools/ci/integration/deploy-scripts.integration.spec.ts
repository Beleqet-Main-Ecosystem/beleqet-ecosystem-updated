/**
 * Integration tests for the staging deployment scripts.
 *
 * Each test executes the REAL bash scripts from `scripts/deploy/` inside an
 * isolated temp directory, with `docker`, `curl`, and `ssh` replaced by mock
 * executables that record every invocation. No real containers, servers, or
 * credentials are involved; the live Docker path is exercised separately by
 * the local staging simulation (see docs/CI_CD_TEST_REPORT.md).
 *
 * Runs on Linux CI runners and on Windows via Git Bash.
 */

import { spawnSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const DEPLOY_DIR = path.join(REPO_ROOT, 'scripts', 'deploy');

const TARGET_SHA = 'a'.repeat(40);
const PREVIOUS_SHA = 'b'.repeat(40);
const SECRET_TOKEN = 'synthetic_ghcr_secret_token_zq81x';

/** Locate a bash executable that works on this platform. */
function resolveBash(): string {
  if (process.platform !== 'win32') {
    return 'bash';
  }
  const candidates = [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return 'bash';
}

const BASH = resolveBash();

interface Sandbox {
  readonly dir: string;
  readonly mockBin: string;
  readonly mockLog: string;
}

/** Build a sandbox: staging files + mock docker/curl/ssh on PATH. */
function makeSandbox(): Sandbox {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'beleqet-deploy-test-'));
  const mockBin = path.join(dir, 'mock-bin');
  const mockLog = path.join(dir, 'mock-invocations.log');
  fs.mkdirSync(mockBin);

  fs.copyFileSync(
    path.join(REPO_ROOT, 'docker-compose.staging.yml'),
    path.join(dir, 'docker-compose.staging.yml'),
  );

  fs.writeFileSync(
    path.join(dir, '.env.staging'),
    [
      'IMAGE_NAMESPACE=ghcr.io/example/beleqet',
      'GHCR_REGISTRY=ghcr.io',
      'GHCR_USERNAME=synthetic-user',
      `GHCR_TOKEN=${SECRET_TOKEN}`,
      'HEALTH_URL_BACKEND=http://127.0.0.1:4000/api/v1/health/ready',
      'HEALTH_URL_ADMIN=http://127.0.0.1:3000/',
      'HEALTH_URL_JOBS=http://127.0.0.1:3001/',
      'STAGING_DB_USER=synthetic_user',
      'STAGING_DB_NAME=synthetic_db',
      'STAGING_DB_PASSWORD=synthetic_password',
      '',
    ].join('\n'),
  );

  // Mock docker: logs every call; behavior toggles via MOCK_* env vars.
  writeExecutable(
    path.join(mockBin, 'docker'),
    `#!/usr/bin/env bash
echo "docker $*" >> "$MOCK_LOG"
if [ "$1" = "login" ]; then cat > /dev/null; exit 0; fi
if [ "$1" = "image" ] && [ "$2" = "inspect" ]; then
  [ "\${MOCK_IMAGE_MISSING:-0}" = "1" ] && exit 1
  exit 0
fi
if [ "$1" = "compose" ]; then
  for arg in "$@"; do
    case "$arg" in
      pull) [ "\${MOCK_PULL_EXIT:-0}" != "0" ] && exit "\${MOCK_PULL_EXIT}"; exit 0 ;;
      ps) if [ "\${MOCK_DB_RUNNING:-1}" = "1" ]; then echo "db"; fi; exit 0 ;;
      pg_dump) echo "-- synthetic dump"; exit 0 ;;
      migrate) exit "\${MOCK_MIGRATE_EXIT:-0}" ;;
      logs) echo "synthetic container logs"; exit 0 ;;
    esac
  done
  exit 0
fi
exit 0
`,
  );

  // Mock curl: emits an HTTP status code for -w '%{http_code}'. Fails the
  // first MOCK_CURL_FAIL_FIRST calls, then returns 200.
  writeExecutable(
    path.join(mockBin, 'curl'),
    `#!/usr/bin/env bash
url="\${@: -1}"
echo "curl $url" >> "$MOCK_LOG"
count_file="\${MOCK_STATE_DIR}/curl-count"
count=0
[ -f "$count_file" ] && count="$(cat "$count_file")"
count=$((count + 1))
echo "$count" > "$count_file"
if [ "$count" -le "\${MOCK_CURL_FAIL_FIRST:-0}" ]; then echo -n "000"; else echo -n "200"; fi
exit 0
`,
  );

  // Mock ssh: the deploy scripts run ON the staging host and must never
  // re-invoke ssh themselves; any call to this mock is a design violation.
  writeExecutable(
    path.join(mockBin, 'ssh'),
    `#!/usr/bin/env bash
echo "ssh $*" >> "$MOCK_LOG"
exit 0
`,
  );

  return { dir, mockBin, mockLog };
}

function writeExecutable(filePath: string, content: string): void {
  fs.writeFileSync(filePath, content, { mode: 0o755 });
  fs.chmodSync(filePath, 0o755);
}

interface RunResult {
  readonly status: number | null;
  readonly output: string;
  readonly log: string;
}

/**
 * Run one of the deploy scripts inside the sandbox.
 *
 * The mock-bin directory is prepended to PATH from INSIDE bash: Git Bash on
 * Windows prepends its own /mingw64/bin (which bundles a real curl) at
 * process start, so a PATH set only on the spawned process would lose to it.
 */
function runScript(
  sandbox: Sandbox,
  script: 'deploy-staging.sh' | 'rollback.sh' | 'health-check.sh',
  args: readonly string[],
  extraEnv: Record<string, string> = {},
): RunResult {
  const scriptPath = path.join(DEPLOY_DIR, script).replace(/\\/g, '/');
  const wrapper = [
    'if command -v cygpath >/dev/null 2>&1; then MB="$(cygpath -u "$MOCK_BIN")"; else MB="$MOCK_BIN"; fi',
    'export PATH="$MB:$PATH"',
    'exec bash "$@"',
  ].join('\n');
  const result = spawnSync(BASH, ['-c', wrapper, '--', scriptPath, ...args], {
    cwd: sandbox.dir,
    encoding: 'utf8',
    timeout: 60_000,
    env: {
      ...process.env,
      MOCK_BIN: sandbox.mockBin,
      MOCK_LOG: sandbox.mockLog,
      MOCK_STATE_DIR: sandbox.dir,
      HEALTH_MAX_ATTEMPTS: '2',
      HEALTH_RETRY_DELAY: '0',
      ...extraEnv,
    },
  });
  const log = fs.existsSync(sandbox.mockLog) ? fs.readFileSync(sandbox.mockLog, 'utf8') : '';
  return {
    status: result.status,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`,
    log,
  };
}

function cleanup(sandbox: Sandbox): void {
  fs.rmSync(sandbox.dir, { recursive: true, force: true });
}

jest.setTimeout(120_000);

describe('deploy-staging.sh (mocked docker/curl/ssh)', () => {
  it('deploys successfully: migrates before promotion, health-checks after startup, records the SHA', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA]);
      expect(result.status).toBe(0);

      const lines = result.log.split('\n');
      const migrateIndex = lines.findIndex((l) => l.includes('migrate deploy'));
      const upIndex = lines.findIndex((l) => l.includes('up -d --remove-orphans'));
      const firstHealthIndex = lines.findIndex((l) => l.startsWith('curl '));

      // Migration must complete before the new release is promoted…
      expect(migrateIndex).toBeGreaterThan(-1);
      expect(upIndex).toBeGreaterThan(migrateIndex);
      // …and health checks only run after the services were started.
      expect(firstHealthIndex).toBeGreaterThan(upIndex);

      // Successful deployment records the deployed SHA.
      const state = fs.readFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), 'utf8');
      expect(state.trim()).toBe(TARGET_SHA);

      // The lock is released afterwards.
      expect(fs.existsSync(path.join(sandbox.dir, '.beleqet-deploy.lock'))).toBe(false);

      // A pre-migration database backup was captured.
      const backups = fs.readdirSync(path.join(sandbox.dir, 'backups'));
      expect(backups.some((f) => f.includes(`pre-${TARGET_SHA}`))).toBe(true);

      // The server-side script never re-invokes ssh.
      expect(result.log).not.toContain('ssh ');
    } finally {
      cleanup(sandbox);
    }
  });

  it('never prints secret values', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA]);
      expect(result.status).toBe(0);
      expect(result.output).not.toContain(SECRET_TOKEN);
      expect(result.log).not.toContain(SECRET_TOKEN);
    } finally {
      cleanup(sandbox);
    }
  });

  it('rejects an invalid SHA before touching anything', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'deploy-staging.sh', ['latest']);
      expect(result.status).toBe(1);
      expect(result.log).not.toContain('docker compose');
    } finally {
      cleanup(sandbox);
    }
  });

  it('allows only one deployment at a time', () => {
    const sandbox = makeSandbox();
    try {
      fs.mkdirSync(path.join(sandbox.dir, '.beleqet-deploy.lock'));
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA]);
      expect(result.status).toBe(2);
      expect(result.output).toContain('in progress');
      // The held lock must not be deleted by the refused run.
      expect(fs.existsSync(path.join(sandbox.dir, '.beleqet-deploy.lock'))).toBe(true);
    } finally {
      cleanup(sandbox);
    }
  });

  it('stops before promotion when the migration fails and preserves the backup', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA], {
        MOCK_MIGRATE_EXIT: '3',
      });
      expect(result.status).toBe(3);
      // Services must NOT have been promoted after a failed migration.
      expect(result.log).not.toContain('up -d --remove-orphans');
      // No success recorded.
      expect(fs.existsSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'))).toBe(false);
      // The pre-migration backup file is preserved for manual recovery.
      const backups = fs.readdirSync(path.join(sandbox.dir, 'backups'));
      expect(backups.length).toBeGreaterThan(0);
    } finally {
      cleanup(sandbox);
    }
  });

  it('fails a pull error without promoting services', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA], {
        MOCK_PULL_EXIT: '1',
      });
      expect(result.status).toBe(5);
      expect(result.log).not.toContain('up -d');
    } finally {
      cleanup(sandbox);
    }
  });

  it('triggers container rollback to the previous SHA when health checks fail, and preserves diagnostics', () => {
    const sandbox = makeSandbox();
    try {
      fs.writeFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), `${PREVIOUS_SHA}\n`);
      // Enough consecutive curl failures to exhaust deploy health attempts
      // AND the rollback verification attempts (2 + 2 with our test bounds).
      const result = runScript(sandbox, 'deploy-staging.sh', [TARGET_SHA], {
        MOCK_CURL_FAIL_FIRST: '2',
      });
      expect(result.status).toBe(4);

      // Rollback rewrote the image set to the previous SHA.
      const images = fs.readFileSync(path.join(sandbox.dir, '.env.images'), 'utf8');
      expect(images).toContain(PREVIOUS_SHA);
      expect(images).not.toContain(TARGET_SHA);

      // The failing SHA was never recorded as successful.
      const state = fs.readFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), 'utf8');
      expect(state.trim()).toBe(PREVIOUS_SHA);

      // Diagnostic logs were preserved.
      const logDir = path.join(sandbox.dir, 'deploy-logs');
      const files = fs.readdirSync(logDir);
      expect(files.some((f) => f.startsWith('ps-'))).toBe(true);
      expect(files.some((f) => f.startsWith('logs-'))).toBe(true);
    } finally {
      cleanup(sandbox);
    }
  });
});

describe('rollback.sh (mocked docker/curl)', () => {
  it('refuses rollback when no previous deployment exists', () => {
    const sandbox = makeSandbox();
    try {
      const result = runScript(sandbox, 'rollback.sh', [TARGET_SHA]);
      expect(result.status).toBe(1);
      expect(result.output).toContain('impossible');
    } finally {
      cleanup(sandbox);
    }
  });

  it('refuses rollback to the failing SHA itself', () => {
    const sandbox = makeSandbox();
    try {
      fs.writeFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), TARGET_SHA);
      const result = runScript(sandbox, 'rollback.sh', [TARGET_SHA]);
      expect(result.status).toBe(1);
    } finally {
      cleanup(sandbox);
    }
  });

  it('refuses an invalid stored SHA', () => {
    const sandbox = makeSandbox();
    try {
      fs.writeFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), 'not-a-sha');
      const result = runScript(sandbox, 'rollback.sh', [TARGET_SHA]);
      expect(result.status).toBe(1);
    } finally {
      cleanup(sandbox);
    }
  });

  it('rolls back and verifies health', () => {
    const sandbox = makeSandbox();
    try {
      fs.writeFileSync(path.join(sandbox.dir, '.beleqet-last-successful-sha'), PREVIOUS_SHA);
      const result = runScript(sandbox, 'rollback.sh', [TARGET_SHA]);
      expect(result.status).toBe(0);
      const images = fs.readFileSync(path.join(sandbox.dir, '.env.images'), 'utf8');
      expect(images).toContain(PREVIOUS_SHA);
      expect(result.log).toContain('up -d');
    } finally {
      cleanup(sandbox);
    }
  });
});

describe('deployment workflow guards (static)', () => {
  const workflowPath = path.join(REPO_ROOT, '.github', 'workflows', 'deploy-staging.yml');

  it('pull-request events can never invoke deployment', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    // Triggers are restricted to workflow_run (CI on main) and manual dispatch.
    expect(workflow).toContain('workflow_run');
    expect(workflow).toContain('workflow_dispatch');
    expect(workflow).not.toMatch(/^\s{2}pull_request:/m);
    // The guard requires a successful, push-triggered CI run on main.
    expect(workflow).toContain("== 'success'");
    expect(workflow).toContain("== 'push'");
    expect(workflow).toContain("== 'main'");
  });

  it('uses a non-cancelling deployment concurrency group', () => {
    const workflow = fs.readFileSync(workflowPath, 'utf8');
    expect(workflow).toContain('concurrency');
    expect(workflow).toContain('cancel-in-progress: false');
  });
});
