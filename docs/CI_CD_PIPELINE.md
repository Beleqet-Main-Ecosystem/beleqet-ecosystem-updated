# Beleqet CI/CD Pipeline

- **Task:** Admin & Control — CI/CD Pipeline
- **Author:** Nathnael Mesfin (`Nathnaelmesfin`)

This document explains how the pipeline works end to end. The audit that
motivated it is in [CI_CD_AUDIT.md](CI_CD_AUDIT.md); operational instructions
are in [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md); verified results are in
[CI_CD_TEST_REPORT.md](CI_CD_TEST_REPORT.md).

---

## 1. Architecture

Two workflows:

| Workflow | File | Purpose |
| --- | --- | --- |
| **CI** | `.github/workflows/ci.yml` | Validates every PR and push to `main`; builds and smoke-tests production images; pushes SHA-tagged images to GHCR on push to `main`. |
| **Deploy Staging** | `.github/workflows/deploy-staging.yml` | Deploys the exact tested commit to the staging server after CI succeeds on `main`; manual dry-run mode for validation. |

Supporting code:

- `tools/ci/` — TypeScript helpers (environment validation, deployment policy,
  image-tag safety, HTTP health checks, rollback selection). Unit- and
  integration-tested via `npm run test:ci-cd`; the deploy workflow invokes the
  validator and health checker through `ts-node`.
- `scripts/ci/` — shell helpers for CI (synthetic test env, Compose validation).
- `scripts/deploy/` — the server-side deployment scripts (deploy, migrate,
  health-check, rollback). ShellCheck-clean, `set -Eeuo pipefail`, LF-only.
- `docker-compose.staging.yml` + `.env.staging.example` — the staging stack.

## 2. Event triggers

- `pull_request` → `main`: full CI validation. **No deployment is possible from
  a pull request** (see §4).
- `push` → `main` (i.e. after a PR merges): full CI validation **plus** GHCR
  image publish; a successful run then triggers the deploy workflow via
  `workflow_run`.
- `workflow_dispatch`: CI can be run manually on any branch; the deploy
  workflow can be dispatched manually with `dry_run=true` (validate/plan from
  any branch) or `dry_run=false` (real deploy, `main` only).

## 3. CI job graph

```text
repo-validation ─┐
backend-quality ─┤
backend-unit ────┤
backend-integration ─┤
admin-frontend ──┼──▶ ci-success   (single required status check)
jobs-frontend ───┤
playwright-e2e ──┤
docker-build ────┤
security ────────┘
```

All nine jobs run in parallel; `ci-success` fails unless every one of them
succeeded (skipped/cancelled also fail it). Branch protection needs to require
only `ci-success`.

| Job | What it runs |
| --- | --- |
| repo-validation | actionlint, ShellCheck, hadolint (error threshold), `docker compose config` for all compose files (incl. required-variable enforcement for staging), gitleaks secret scan |
| backend-quality | `npm ci`, Prisma generate, non-mutating ESLint (`--max-warnings=0`), Prettier check, `tsc --noEmit` (src+test+tools), NestJS production build |
| backend-unit | Postgres 15 + Redis 7 service containers, synthetic env, `prisma migrate deploy`, Jest unit suite, coverage (uploaded 7 days), `npm run test:ci-cd` (helper unit + integration tests) |
| backend-integration | Service containers, module integration specs (`*.integration.spec.ts`), NestJS E2E (`test/*.e2e-spec.ts`), boots the built app and runs live HTTP smoke tests against `/api/v1/health`, `/api/v1/health/ready`, `/api/v1/jobs/categories` |
| admin-frontend | `npm ci`, ESLint, `tsc --noEmit`, production build (no unit tests exist — none are claimed) |
| jobs-frontend | `npm ci`, ESLint, `tsc --noEmit`, Vitest suite (`lib/__tests__/*.test.ts`), Jest suite (`lib/**/*.spec.ts` — distinct scope), production build |
| playwright-e2e | **Blocking** (the old `continue-on-error: true` is gone). Live backend + service containers, Playwright API-level 2FA step-up tests, report/traces uploaded on failure (7-day retention) |
| docker-build | Builds all three production images, boots the **full staging compose stack** from them (db → migrate → all services → health checks), Trivy image scans (fail on unfixed CRITICAL; HIGH+CRITICAL reports uploaded), pushes `:<sha>` images to GHCR on push to `main` only |
| security | `npm audit --omit=dev` for all three packages; **fails on CRITICAL**, reports lower severities |

## 4. Why deployment cannot run from pull requests

Defense in depth, each layer independently sufficient:

1. The deploy workflow's only triggers are `workflow_run` (of CI) and
   `workflow_dispatch` — there is no `pull_request` trigger.
2. The `workflow_run` guard requires `conclusion == 'success' &&
   event == 'push' && head_branch == 'main'`; a CI run for a PR has
   `event == 'pull_request'` and is refused.
3. `workflow_run` workflows always execute the workflow file from the default
   branch, so a PR cannot smuggle in a modified deploy workflow.
4. Images are only pushed to GHCR on `push` to `main`; a PR SHA has no
   published image to deploy.
5. The policy is codified and unit-tested in `tools/ci/deployment-policy.ts`,
   and a static integration test asserts the workflow file keeps these guards.

## 5. Docker image flow

- CI builds `ghcr.io/<owner>/<repo>/beleqet-{backend,admin-frontend,jobs-frontend}`.
- Tags are the **exact 40-character commit SHA** — deterministic, traceable,
  and validated everywhere (`tools/ci/image-tag.ts`, shell-side checks).
- On push to `main`, CI pushes the three `:<sha>` images to GHCR.
- After a **verified healthy** staging deployment, the workflow moves the
  mutable `:staging` alias to that SHA (`docker buildx imagetools create`).
  The alias is a convenience pointer only — deployment and rollback always
  operate on SHA tags.

Image hygiene: multi-stage builds, `npm ci` from committed lockfiles
(never `npm install`), production-only runtime dependencies, non-root `USER
node`, `HEALTHCHECK`s, `.dockerignore` in every build context, and **no
`prisma db push` anywhere** — the backend container starts with plain
`node dist/main`.

## 6. Staging deployment sequence

Executed by `scripts/deploy/deploy-staging.sh` on the staging server (invoked
over SSH by the workflow):

1. Validate CLI, SHA format, compose file, `.env.staging` variables.
2. Acquire the deployment lock (`mkdir`-atomic; refuses concurrent deploys —
   in addition to the workflow's non-cancelling `deploy-staging` concurrency
   group).
3. Record the currently deployed SHA as the rollback target.
4. Pin `.env.images` to the new SHA and pull the three images; verify each
   exists locally afterwards.
5. `pg_dump` database backup (gzip, UTC-stamped) — **before** any migration;
   a failed backup aborts the deployment.
6. `prisma migrate deploy` exactly once (`migrate.sh`, one-off container).
   A migration failure stops everything: services are not restarted, the
   previous release keeps running, the backup path is printed.
7. `docker compose up -d` the new release.
8. Bounded health checks (backend readiness, both frontends).
9. On success: record the SHA, prune only dangling layers, release the lock.

## 7. Health checks

- `GET /api/v1/health` — liveness (process serves HTTP). Used by container
  `HEALTHCHECK`s.
- `GET /api/v1/health/ready` — readiness: bounded round-trips to PostgreSQL
  (`SELECT 1`) and Redis (`PING`); 200 when both up, 503 otherwise. Used by
  the deploy gate and CI smoke tests.
- Responses contain status and latency only — never errors, hosts, or
  configuration. (This module was added by this task because no application
  health endpoint existed; see audit §3.5.)
- Probing is bounded everywhere: `scripts/deploy/health-check.sh` and
  `tools/ci/health-check.ts` both retry transient failures up to a maximum
  attempt count and never retry configuration errors.

## 8. Rollback

- **Containers:** on a failed health check, `rollback.sh` restores the last
  recorded healthy SHA — after validating it (full 40-hex, distinct from the
  failing SHA; rules unit-tested in `tools/ci/rollback.ts`) — restarts the
  stack, and re-verifies health. Diagnostics (`compose ps`, tail of logs) are
  preserved under `deploy-logs/` first.
- **Database:** never rolled back automatically. Prisma migrations are
  roll-forward; the pre-migration backup plus the runbook's restore procedure
  is the recovery path. The deploy summary states this explicitly.

## 9. Security controls

- `permissions: contents: read` at workflow level; `packages: write` only on
  the two jobs that push/tag images; deploy secrets live only in the `staging`
  GitHub Environment.
- All GitHub Actions pinned to commit SHAs; third-party tools run as
  version-pinned containers.
- SSH uses a dedicated deploy user and **strict host-key checking** against
  the `STAGING_KNOWN_HOSTS` secret — never `StrictHostKeyChecking=no`.
- Secrets: gitleaks scan in CI; environment validator refuses placeholder
  secrets and never echoes values; deploy scripts log names, statuses, and
  URLs only; registry login via `--password-stdin`.
- Vulnerabilities: Trivy image scans (unfixed CRITICAL fails), npm audit
  (CRITICAL fails) — current baseline in the audit.
- GDPR-awareness: synthetic data only in CI; no personal data in logs or
  artifacts; artifact retention capped at 7 days; timestamps in UTC.

## 10. Artifact retention

| Artifact | When | Retention |
| --- | --- | --- |
| backend-coverage | always | 7 days |
| playwright-report (report + traces) | on failure | 7 days |
| trivy-image-reports | always | 7 days |

## 11. Troubleshooting

| Symptom | Where to look |
| --- | --- |
| `ci-success` red, everything else green | One job was skipped/cancelled — open the run's job list |
| gitleaks failure | The redacted finding names file+rule; rotate and remove the secret, never force-push over it |
| Staging compose refuses to render | A `${VAR:?}` guard fired — the error names the missing variable |
| Deploy fails at "another deployment appears to be in progress" | A crashed run left `.beleqet-deploy.lock` — verify nothing is deploying, then `rmdir` it (runbook §9) |
| Deploy fails at migration | Previous release still runs; check `prisma migrate status`, backup is preserved under `backups/` |
| Health check fails after deploy | `deploy-logs/` on the server has `ps`/`logs` snapshots; containers were rolled back to the previous SHA if one was recorded |
| Manual real deploy refused | Real deploys are restricted to `main`; dry-run works from any branch |
