# CI/CD Test Report — Beleqet

- **Task:** Admin & Control — CI/CD Pipeline
- **Author:** Nathnael Mesfin (`Nathnaelmesfin`)
- **Report generated:** 2026-07-18 (UTC) — updated through final verification

Environment for all local runs:

| Item | Value |
| --- | --- |
| OS | Windows 11 Pro 10.0.26200 (Docker Desktop, Linux containers) |
| Node | v20.20.2 (repo targets Node 20; checksum-verified distribution) |
| npm | 10.8.2 |
| Docker | 29.2.1 · Compose v5.1.0 |
| Git | 2.54.0.windows.1 |
| Baseline commit | `389ca9eec7815ad66ba7ae8f842111958558d8b9` (upstream `main`) |

All timestamps UTC. No real credentials were used anywhere; every environment
value in every run is synthetic.

---

## 1. Baseline (before changes) — 2026-07-18

Commands run from a clean clone at the baseline commit.

| Check | Command | Result |
| --- | --- | --- |
| Backend install | `npm ci` | ✅ 1053 packages |
| Prisma generate | `npm run prisma:generate` | ✅ |
| Backend build | `npm run build` | ✅ |
| Backend unit tests | `npm test -- --runInBand` | ✅ 49 suites, 469 tests, ~116 s |
| Backend coverage | `npm run test:cov -- --runInBand` | ✅ 44.64 % stmts / 44.4 % branch / 39.56 % funcs / 44.94 % lines |
| Backend E2E | `npm run test:e2e -- --runInBand` | ✅ 1 suite, 4 tests |
| Backend ESLint (non-mutating) | `npx eslint "{src,apps,libs,test}/**/*.ts" --max-warnings=0` | ❌ **fatal** — `eslint-plugin-prettier` referenced by `.eslintrc.js` but not installed |
| Backend Prettier check | `npx prettier --check "src/**/*.ts" "test/**/*.ts"` | ❌ 128 files non-conforming |
| Admin frontend install | `npm ci` (frontend/) | ❌ lockfile out of sync (`lucide-react@0.499.0` missing from lock) |
| Jobs frontend install | `npm ci` (beleqet-jobs-nextjs/) | ❌ committed lockfile is **corrupt JSON** (parse error at offset 10003 — bad manual merge, duplicated unclosed `engines` block) |
| Admin frontend lint | `npm run lint` | ❌ inherits backend `.eslintrc.js`; every file fails parsing |
| Admin frontend types | `npx tsc --noEmit` | ❌ TS7016 — `qrcode` used but not declared (resolves only via hoisted root `node_modules`) |
| Admin frontend build | `npm run build` | ❌ (lint parse failures during `next build`) |
| Jobs frontend lint | `npm run lint` | ❌ 7 errors: `Toaster` undefined in `app/layout.tsx`, 5 × conditional-hook violations in `app/profile/page.tsx`, unescaped entity in `AvailabilityCard.tsx` |
| Jobs frontend types | `npx tsc --noEmit` | ❌ 2 errors (`Toaster` undefined; invalid cast in `lib/__tests__/seo.test.ts`) |
| Jobs frontend Vitest | `npm run test` | ✅ |
| Jobs frontend Jest | `npm run test:unit -- --runInBand` | ✅ |
| Jobs frontend build | `npm run build` | ❌ (lint errors during `next build`) |
| Compose build | `docker compose build` | ❌ `beleqet-jobs-nextjs/Dockerfile` referenced by compose but **does not exist** |
| npm audit (critical, prod deps) | all 3 packages | ✅ exit 0 — no CRITICAL findings (moderate/high exist, reported not gated) |

After the fixes on this branch, every ❌ above is green — see §2/§3.

Also verified at baseline: `nestjs-i18n@10.8.5` declares `engines.node >= 22`
while the whole repo targets Node 20 (EBADENGINE warning only; app builds and
tests pass on Node 20 — noted, no dependency change made).

## 2. Post-change local verification — 2026-07-18

Same machine, Node 20.20.2, at the head of `feat/ci-cd-pipeline-nathnael`.

| Check | Command | Result |
| --- | --- | --- |
| Backend ESLint | `npm run lint` (now non-mutating, `--max-warnings=0`) | ✅ 0 problems |
| Backend Prettier | `npm run format:check` | ✅ all files conform |
| Backend TypeScript | `npx tsc --noEmit` (src + test + tools) | ✅ |
| Backend build | `npm run build` | ✅ |
| Backend unit tests | `npm test -- --runInBand` | ✅ 51 suites, 478 tests (49→51 suites, 469→478 tests: health module added) |
| Backend coverage | `npm run test:cov -- --runInBand` | ✅ 44.96 % stmts / 44.66 % branch / 40.49 % funcs / 45.03 % lines |
| Backend E2E | `npm run test:e2e -- --runInBand` | ✅ 2 suites, 8 tests (ai-feed + health) |
| CI/CD helper tests | `npm run test:ci-cd` | ✅ 7 suites, 95 tests (78 unit + 17 integration: mocked-executable deploy-script runs + real `docker compose config` renders) |
| `npm ci` reproducibility | root, frontend, jobs | ✅ all three install clean from the repaired lockfiles |
| Admin frontend | lint / tsc / build | ✅ / ✅ / ✅ |
| Jobs frontend | lint / tsc / vitest / jest / build | ✅ / ✅ / ✅ / ✅ / ✅ |
| Workflow lint | `actionlint 1.7.7` (container) | ✅ 0 findings (both workflows) |
| Shell scripts | `shellcheck v0.10.0` (container, all 6 scripts) | ✅ 0 findings |

(unit-test count differences vs baseline: +9 health service/controller unit
tests and +4 health e2e tests added by this branch; pre-existing spec files
lost only dead code, no test cases.)

## 3. Live Docker verification — 2026-07-18 (19:14–19:36 UTC)

Full local live staging simulation: real production images (built from this
branch), real PostgreSQL 15 + Redis 7, the real `scripts/deploy/*` scripts,
isolated under compose project `beleqet_ci_cd_test`. Log excerpts below are
from the captured run (`sim-full2.log`); timestamps UTC.

| Step | Result |
| --- | --- |
| Build all three production images | ✅ (backend, admin, jobs — multi-stage, `npm ci`) |
| First deployment (SHA `a69ed4f…`) | ✅ 19:31:08 `deployment complete` — db+redis started with `--wait`, all 10 Prisma migrations applied once, all services healthy |
| Backend readiness (`/api/v1/health/ready`) | ✅ HTTP 200 |
| API smoke (`/api/v1/jobs/categories`) | ✅ HTTP 200 |
| Admin frontend (`:3000`) / Jobs frontend (`:3001`) | ✅ HTTP 200 / HTTP 200 |
| All five containers `healthy` (`compose ps`) | ✅ |
| Restart backend → recovery | ✅ healthy again on attempt 4 (~12 s) |
| Second deployment (test tag `bbbb…`) | ✅ 19:32:13 complete; state file records the new SHA |
| Playwright vs the LIVE containerized stack | ✅ **6/6 passed** (2.3 min, real 2FA step-up API flows) |
| Broken release (`cccc…`: boots, never listens) | ✅ health FAILED as expected; diagnostics (`ps`/`logs`) preserved under `deploy-logs/` |
| **Container rollback** | ✅ 19:34:48 `rollback to bbbb… is healthy` — image refs restored to the previous SHA, failing SHA nowhere referenced, state file intact |
| Post-rollback verification | ✅ backend/admin/jobs all HTTP 200; five containers `healthy` |
| Pre-migration DB backups | ✅ one gzip backup per deployment attempt (incl. before the failed one) |
| Teardown | ✅ `down -v` on the isolated project only; test tags removed; no unrelated volumes touched |

The simulation also **found and fixed two real deploy-script bugs** before
they could reach a server: the first-deploy migration raced Postgres startup
(fixed with `up -d --wait`), and a failing release aborted via `set -e` on
`compose up`'s exit code before the health-check → rollback path could run
(fixed so bounded health checks are the authoritative verdict).

## 4. GitHub Actions verification (fork `Nathnaelmesfin/beleqet-ecosystem-updated`)

CI was executed via an internal draft PR in the fork (#1) so the
`pull_request` path runs exactly as it will upstream. Iterations were real
runs; every failure was diagnosed, fixed, committed, and re-run:

| Run | Commit | Result | Notes |
| --- | --- | --- | --- |
| [29645956918](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29645956918) | `641d514` | ❌ | Found: missing exec bits on scripts, ESLint whole-tree traversal, frontend `e2e/` in tsconfig, LB-overlay render, **and Playwright passed** |
| [29656752027](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29656752027) | `86c1645` | ❌ | Found: gitleaks — 19 findings incl. a **real hard-coded Chapa test credential** (removed; audit §3.7); `vite.config.ts` in admin tsconfig |
| [29657178725](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29657178725) | `a69ed4f` | ❌ | 8/9 green; full-stack smoke exposed the backend's boot-time env contract (OAuth set) |
| [29657662862](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29657662862) | `0bb2a53` | ✅ **all 9 jobs green** | First fully green run incl. full-stack boot + Trivy |
| [29657943574](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29657943574) | `e3f6b16` | ✅ **all 9 jobs green** | Final code state |

Per-job results in the green runs: Repo & workflow validation ✅ · Backend
lint/format/types/build ✅ · Backend unit & coverage (incl. `test:ci-cd`) ✅ ·
Backend integration & E2E (live service containers + HTTP smoke) ✅ · Admin
frontend ✅ · Jobs frontend (Vitest + Jest + build) ✅ · **Playwright E2E
(blocking)** ✅ · Docker build + full staging-stack smoke + Trivy scans ✅ ·
Dependency security audit ✅ · `ci-success` aggregate ✅.

### Deployment workflow dry-run (real GitHub execution)

[Run 29658202218](https://github.com/Nathnaelmesfin/beleqet-ecosystem-updated/actions/runs/29658202218)
— `workflow_dispatch` with `dry_run=true` on the feature branch: **success**.
Verified from the step list: credentials detected as absent (names only),
fail-fast correctly skipped in dry-run mode, all three images built at the
exact SHA, deployment plan written to the run summary, and every
server-contact step (SSH config, artifact copy, remote deploy, staging alias)
skipped. No server was contacted; nothing was deployed.

(Workflow registration note: `workflow_dispatch` requires the workflow to be
registered, which happens from the default branch. The fork's default branch
was switched to the feature branch for this dispatch and restored to `main`
immediately after — no commits were made to `main` at any point.)

## 5. Remote staging deployment

Remote staging deployment was **not executed**: no staging server credentials
(`STAGING_HOST`, `STAGING_SSH_PRIVATE_KEY`, …) exist in this fork —
`gh secret list --repo Nathnaelmesfin/beleqet-ecosystem-updated --env staging`
returns HTTP 404 (the `staging` environment has never been created), and the
repository has no repository-level secrets either. The deployment path was
verified instead by:

1. the mocked-executable integration suite (§2),
2. the full local live staging simulation including rollback (§3), and
3. the real GitHub Actions dry-run of `deploy-staging.yml` (§4).

No claim of a real staging deployment is made anywhere in this submission.

## 6. Required test matrix

| Area | Required validation | Status |
| --- | --- | --- |
| Git configuration | Correct GitHub account, author name, and email | ✅ `Nathnaelmesfin` verified via API; all commits authored `Nathnael Mesfin <73286501+Nathnaelmesfin@users.noreply.github.com>` |
| Repository sync | Fork synchronized with upstream | ✅ `gh repo sync`; main == upstream/main == `389ca9e` |
| Workflow syntax | Actionlint passes | ✅ (locally in container + CI job, 0 findings) |
| Shell scripts | ShellCheck passes | ✅ v0.10.0, all 6 scripts, 0 findings |
| Dockerfiles | Hadolint validation passes | ✅ error threshold, all 3 Dockerfiles |
| Compose | All Compose files render | ✅ dev, LB overlay (`--profile standalone`), staging (+ required-var rejection verified) |
| Formatting | Prettier check passes | ✅ (was 128 files failing at baseline) |
| Backend lint | ESLint passes without modifying files | ✅ `--max-warnings=0` (lint was fatally broken at baseline) |
| Backend TypeScript | Strict build/type validation passes | ✅ `tsc --noEmit` over src+test+tools |
| Backend unit tests | All Jest unit tests pass | ✅ 51 suites / 478 tests |
| Backend coverage | Coverage report generated | ✅ generated locally + uploaded as CI artifact (7-day retention) |
| CI/CD helper tests | All Jest helper tests pass | ✅ 7 suites / 95 tests (78 unit + 17 integration) |
| Backend integration | All integration tests pass | ✅ module `*.integration.spec.ts` suites in CI with live Postgres/Redis |
| Backend E2E | All NestJS E2E tests pass | ✅ 2 suites / 8 tests |
| Admin frontend lint | Passes | ✅ (own `.eslintrc.json`; was unparseable at baseline) |
| Admin frontend TypeScript | Passes | ✅ |
| Admin frontend build | Production build passes | ✅ |
| Admin frontend tests | Pass if tests exist | ➖ no unit tests exist; none claimed (lint/types/build/Playwright cover it) |
| Jobs frontend lint | Passes | ✅ (7 errors fixed, incl. rules-of-hooks) |
| Jobs frontend TypeScript | Passes | ✅ |
| Jobs frontend Vitest | Passes | ✅ |
| Jobs frontend Jest | Passes (distinct suite) | ✅ |
| Jobs frontend build | Production build passes | ✅ |
| Playwright | All required browser tests pass | ✅ 6/6 — blocking in CI (3× green) AND against the live containerized stack |
| Backend image | Builds and starts | ✅ (CI smoke stack + local simulation) |
| Admin image | Builds and starts | ✅ |
| Jobs image | Builds and starts | ✅ (Dockerfile was missing at baseline) |
| PostgreSQL | Becomes healthy; migrations succeed | ✅ 10/10 migrations via `prisma migrate deploy` |
| Redis | Becomes healthy and responds | ✅ |
| Full local stack | Starts successfully | ✅ five healthy containers |
| Backend HTTP smoke | Passes | ✅ `/health`, `/health/ready`, `/jobs/categories` |
| Admin HTTP smoke | Passes | ✅ HTTP 200 |
| Jobs HTTP smoke | Passes | ✅ HTTP 200 |
| Security scan | No unresolved critical finding | ✅ Trivy (unfixed CRITICAL gate) + npm audit critical: clean |
| Secret scan | No committed secrets | ✅ gitleaks clean after removing the pre-existing hard-coded Chapa test credential |
| Rollback integration | Failure triggers previous image selection | ✅ mocked integration test + live forced-failure simulation |
| CI workflow | Real GitHub run succeeds | ✅ runs 29657662862 and 29657943574 |
| CD dry run | Real GitHub run succeeds | ✅ run 29658202218 |
| Remote staging | Only mark passed when actually executed | ➖ **not executed** — no staging credentials exist (see §5) |
