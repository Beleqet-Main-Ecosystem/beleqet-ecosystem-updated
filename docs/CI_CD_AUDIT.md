# CI/CD Audit — Beleqet Ecosystem

- **Task:** Admin & Control — CI/CD Pipeline
- **Author:** Nathnael Mesfin (`Nathnaelmesfin`)
- **Audit date:** 2026-07-18 (UTC)
- **Audited commit:** `389ca9eec7815ad66ba7ae8f842111958558d8b9` (upstream `main`)

This document records what exists in the repository today, what is broken or
missing from a CI/CD and deployment-readiness perspective, and exactly what
this branch changes. Every claim below was verified against the checked-out
tree at the commit above.

---

## 1. Repository architecture

| Component | Path | Stack | Notes |
| --- | --- | --- | --- |
| Backend API | repo root (`src/`) | NestJS 10, Prisma 5, PostgreSQL, Redis (ioredis + BullMQ), Socket.IO | Global prefix `api/v1`, port 4000. 29 feature modules. |
| Admin frontend | `frontend/` | Next.js 14 (`src/app`) + a Vite entry (`index.html`, `src/main.tsx`) used only as the Playwright web-server shell | No unit tests. Has its own `package-lock.json`. |
| Jobs frontend | `beleqet-jobs-nextjs/` | Next.js 14 (App Router) | Vitest owns `lib/__tests__/**/*.test.ts`; Jest owns `lib/**/*.spec.ts` (documented in `jest.config.js` — the suites are distinct, no double-counting). |
| Database schema | `prisma/` | 10 SQL migrations + `schema.prisma` + `seed.ts` | Migrations exist and are deployable with `prisma migrate deploy`. |
| E2E tests | `frontend/e2e/step-up-flows.spec.ts` | Playwright (driver installed at repo root) | API-level tests against a **live backend** at `127.0.0.1:4000` (2FA step-up flows). The Vite server on 5173 is only the Playwright `webServer`. |
| NestJS integration test | `test/ai-feed.e2e-spec.ts` | Jest + supertest | Boots a real Nest app for the AI-feed module (Prisma mocked). |
| Backend unit tests | `src/**/*.spec.ts` | Jest (ts-jest) | 56 spec files. |
| Infra | `infrastructure/nginx/`, `docker-compose.load-balancer.yml` | Nginx load-balancer overlay | Out of CI/CD scope; validated syntactically only. |
| Render deployment | `render.yaml` | Render.com blueprint | Pre-existing, references a `backend/` rootDir that does not match this repo layout; left untouched. |
| Dev utility scripts | `create-admin.js`, `generate-link.js`, `reset-pass.js`, `simulate.js`, `verify-2fa.js`, `webhook-server.js` | Node | Local development helpers; not part of the pipeline. |

### Existing i18n / GDPR / multi-currency functionality (pipeline must build & test it, not reinvent it)

- i18n: `nestjs-i18n` in the backend (`src/i18n/{en,am}/`), locale files in
  `beleqet-jobs-nextjs/locales/` and `beleqet-jobs-nextjs/public/locales/`.
- GDPR: migration `20260714150000_add_gdpr_consent_and_search_history`,
  consent checks in the AI-feed module (covered by existing Jest tests).
- Multi-currency: `currency` fields on jobs (exercised by existing tests),
  global payment gateway migration `20260706000001_global_payment_gateway`.

The pipeline runs the existing suites that cover these; no artificial business
features were added for the sake of the checklist.

---

## 2. Current CI/CD behavior (before this branch)

### `.github/workflows/ci.yml`

- Triggers: `push`/`pull_request` on `main`. No `workflow_dispatch`, no concurrency
  control, no `permissions:` block (defaults to broad token permissions).
- `unit-tests` job: Postgres 15 + Redis 7 service containers, generates a
  synthetic `.env`, runs `prisma generate` → `prisma migrate deploy` → `npm run build`
  → `npm test`. This works and its useful parts are preserved.
- `playwright-e2e` job: **`continue-on-error: true`** (line 95) — the E2E suite
  can fail without failing the pipeline. Non-blocking quality gate.
- Actions referenced by mutable tags (`actions/checkout@v4`, etc.), not pinned SHAs.
- No frontend job of any kind: the admin frontend and jobs frontend are never
  linted, type-checked, tested, or built in CI.
- No Docker build validation, no security/secret scanning, no lint/format gate
  (`npm run lint` is never run in CI — and see §3.1, it would mutate files).
- No single aggregate status check suitable for branch protection.

### `.github/workflows/deploy.yml` ("Auto Deploy to Staging")

- Trigger: `pull_request: closed` on `main` with `if: merged == true`.
- Deploys via `appleboy/ssh-action@v1.0.3` (mutable tag) to a **hard-coded host**
  `staging.beleqet.com:22`, then runs `cd /var/www/beleqet-staging && git pull origin main`.
- Defects: no build, no dependency install, no migration, no health check, no
  rollback, no concurrency guard, no environment protection, no host-key
  verification strategy documented, hard-coded infrastructure address, and the
  deployed artifact is "whatever `git pull` produces" rather than a tested,
  versioned image. A `git pull`-based deploy cannot guarantee the tested commit
  is what runs on staging.
- This workflow is **replaced** by `deploy-staging.yml` (see §5). It is the one
  existing file removed by this branch; its intent (deploy to staging after a PR
  merges to `main`) is preserved and hardened via `workflow_run` on CI success.

---

## 3. Defects found (with evidence)

### 3.1 `package.json` (backend)

- **Duplicate script keys**: `test`, `test:watch`, `test:cov`, `test:e2e` are
  each defined twice (lines 15–18 and 23–27 of the original file). JSON parsers
  keep the last occurrence, so the earlier definitions are dead and misleading.
- **Mutating lint script**: `"lint": "eslint ... --fix"` rewrites source during
  what should be a verification step. CI must never modify code while checking it.
- **No `format:check`** (only `format`, which writes), **no `prisma:migrate:deploy`**
  script (deploy path used `npx` ad hoc), no dedicated CI/CD-helper test script.

### 3.2 Root `Dockerfile` (backend)

- `CMD sh -c "npx prisma db push && npm run start:prod"` — **`prisma db push`
  runs on every container start**. It bypasses the migration history, can drift
  the schema, and belongs nowhere near production startup. Replaced with a
  plain `node dist/main` start; migrations move to an explicit, single
  `prisma migrate deploy` step in the deployment sequence.
- Runs as **root**; no `HEALTHCHECK`; production image carries the full
  `node_modules` including dev dependencies (`npm ci` without `--omit=dev`
  and no prune).

### 3.3 `frontend/Dockerfile` (admin)

- Copies only `package.json` (not `package-lock.json`) and runs **`npm install`**
  — non-reproducible builds despite a lockfile existing in the repo.
- Runs as root, no `HEALTHCHECK`, ships the entire `node_modules` instead of the
  Next standalone output.

### 3.4 `beleqet-jobs-nextjs` — missing Dockerfile

- `docker-compose.yml` (service `jobs-frontend`) references
  `./beleqet-jobs-nextjs` + `dockerfile: Dockerfile`, but **no Dockerfile exists
  there** (verified via `git ls-files`). `docker compose build` fails. This is a
  deployment-readiness defect fixed in scope (new Dockerfile added, service kept).
- No `.dockerignore` there either, so a naive build context would include
  `node_modules`/`.next`.

### 3.5 Health endpoints

- There is **no application-level health endpoint**. Verified candidates:
  - `GET /api/v1/resume-brain/health` — unauthenticated but module-scoped
    ("Resume Brain" status only, checks no dependencies).
  - `render.yaml` uses `GET /api/v1/jobs/categories` as a health path — a
    business endpoint doing real DB work, unsuitable as a readiness contract.
- A minimal `GET /api/v1/health` (liveness) + `GET /api/v1/health/ready`
  (DB `SELECT 1` + Redis `PING`) module is added with unit + e2e tests. It is
  required for bounded deployment health-gating and container `HEALTHCHECK`s;
  it exposes no secrets or internal diagnostics (status/latency only).

### 3.6 `.gitignore` hazards

- `scripts/` is globally ignored ("Project-specific ignores") — the deployment
  scripts this task requires under `scripts/ci/` and `scripts/deploy/` would be
  silently uncommitted. Explicit un-ignore rules are added for exactly those
  two directories.
- `*.txt`, `out*`, `err*` are aggressively ignored (kept as-is; noted so future
  artifacts avoid those names).
- `frontend/.env.local` **is committed** despite `.env.local` being ignored
  (added before the rule, so it stays tracked). Content verified: only
  `NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1` — a public, non-secret
  build-time value. Left in place (removing it would change local dev behavior;
  out of scope), but flagged here.

### 3.7 Secrets / credentials in tracked files

- `docker-compose.yml` and `docker-compose.load-balancer.yml` contain
  development placeholder credentials (`your_password`,
  `docker_default_secret_please_change_in_production`). These are local-dev
  defaults, not real secrets; the new staging compose file uses environment
  interpolation with **no** default secrets.
- **`webhook-server.js` (dev utility) hard-coded a real Chapa TEST-mode
  secret key and a webhook secret.** Found by the gitleaks gate on the first
  real CI run. The file now reads both values from the environment and exits
  if they are absent. ⚠️ The old values remain in git history — **the
  repository owner should rotate that Chapa test key and webhook secret**;
  rotation requires Chapa dashboard access this task does not have.
- No other real tokens/keys were found in tracked files. The remaining
  gitleaks findings were all documented placeholders and synthetic test
  fixtures, allowlisted narrowly in `.gitleaks.toml` (templates, the CI
  test-env generator, and `*.spec.ts` mock data only — runtime code and
  deployment surfaces remain fully scanned).

### 3.8 TypeScript / lint configuration

- `tsconfig.json` is not fully `strict` (has `strictNullChecks`,
  `noImplicitAny`); `.eslintrc.js` sets `@typescript-eslint/no-explicit-any: off`.
  Existing app code is left untouched; all **new** CI/CD helper code under
  `tools/` is written strict-clean with zero `any`.
- `.eslintrc.js` uses `parserOptions.project: tsconfig.json`; `tools/` is
  covered by the root tsconfig (no `include` list, so root TS files are in the
  project) and excluded from `tsconfig.build.json` so `nest build` output is
  unchanged.

### 3.9 Additional defects surfaced by the first real CI run

- **Load-balancer overlay cannot render without its profile**:
  `docker compose -f docker-compose.yml -f docker-compose.load-balancer.yml config`
  fails with `service "frontend" depends on undefined service "backend"` —
  the overlay moves `backend` behind the `standalone` profile while
  `frontend` still depends on it. Pre-existing defect; CI validates the file
  set with `--profile standalone` (the only shape that renders) rather than
  redesigning the overlay, which is out of scope.
- **`frontend/tsconfig.json` included `e2e/`**, whose Playwright tests import
  `@playwright/test`/`otplib` from the ROOT package — so a standalone
  `tsc --noEmit` or Docker build of the admin frontend failed. `e2e` and
  `playwright.config.ts` are now excluded there (they are executed and
  type-transpiled from the repository root, which owns those dependencies).
- **Shell scripts need their executable bit stored in git** (`100755`) —
  files created on Windows default to `100644`, which made
  `deploy-staging.sh`'s direct invocation of `migrate.sh` fail with
  "permission denied" on Linux checkouts (masked locally by Docker Desktop's
  permissive bind mounts).
- **Backend lint glob traversal**: `eslint "{src,…,tools}/**/*.ts"` has no
  literal base directory, so ESLint 8 walks the whole repository and loads
  `beleqet-jobs-nextjs/.eslintrc.json` (whose `next/core-web-vitals` only
  resolves inside that package). The script now lists explicit per-directory
  globs and the root config ignores the frontend trees.

### 3.10 Existing strengths (preserved)

- Working Postgres/Redis service-container pattern and synthetic `.env`
  generation in CI (reused).
- Real migration history applied with `prisma migrate deploy` in CI (kept).
- Meaningful backend unit-test suite (56 spec files) and a real Nest
  integration test.
- Jobs frontend has a clean, documented Jest/Vitest split.
- Multi-stage Docker builds already in use for backend and admin frontend.

---

## 4. Missing CI checks (added by this branch)

1. Workflow/script static validation: `actionlint`, `shellcheck`, `hadolint`,
   `docker compose config`, secret scan (`gitleaks`).
2. Backend lint (non-mutating), Prettier check, and typecheck as required gates.
3. Admin frontend job: `npm ci`, ESLint, `tsc --noEmit`, production build.
   (No unit tests exist there — none are claimed.)
4. Jobs frontend job: `npm ci`, ESLint, `tsc --noEmit`, Vitest suite, Jest
   suite (distinct scopes), production build.
5. Playwright E2E as a **blocking** job against a live backend.
6. Docker build job for all three deployable images + container start
   validation (no publishing on PRs).
7. Dependency + image vulnerability scanning with severity gates.
8. CI/CD helper unit + integration tests (`tools/ci`, `test/jest-ci-cd.json`).
9. A single `ci-success` aggregate job for branch protection.

## 5. Missing deployment functionality (added by this branch)

- `deploy-staging.yml`: `workflow_run`-triggered (CI success on `main` push
  only) + `workflow_dispatch` with `dry_run`. GitHub Environment `staging`,
  minimal permissions, non-cancelling concurrency, SHA-tagged images pushed to
  GHCR, SSH with strict host-key checking (`STAGING_KNOWN_HOSTS`), remote
  deploy script with: config validation → lock → DB backup → single
  `prisma migrate deploy` → image promotion → bounded health checks → container
  rollback to last recorded good SHA on failure → deployment summary.
- `docker-compose.staging.yml` with env interpolation and zero secrets.
- `.env.staging.example` documenting every required variable, grouped.
- Deployment scripts under `scripts/deploy/` (`deploy-staging.sh`,
  `migrate.sh`, `health-check.sh`, `rollback.sh`) and CI helpers under
  `scripts/ci/` — all `set -Eeuo pipefail`, ShellCheck-clean, LF endings,
  no hard-coded hosts or credentials, sanitized logging.

## 6. Scope boundaries

**In scope:** everything under `.github/workflows/`, `tools/ci/`, `scripts/ci/`,
`scripts/deploy/`, `docs/`, Dockerfiles, `.dockerignore` files,
`docker-compose.staging.yml`, `.env.staging.example`, backend `package.json`
script normalization, the minimal health module (`src/modules/health/`), and
the two `.gitignore` un-ignore rules.

**Out of scope (deliberately untouched):** application business logic, existing
tests, `render.yaml`, the Nginx load-balancer overlay, dev compose defaults,
dev utility scripts, dependency version upgrades not required by the pipeline.

## 7. Evidence trail

Baseline command output, test counts, and final verification results are
recorded in `docs/CI_CD_TEST_REPORT.md` (UTC timestamps). GitHub Actions run
URLs for the real CI executions and the deployment dry-run are listed there and
in the pull-request description.
