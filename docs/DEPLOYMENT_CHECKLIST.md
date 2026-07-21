# Staging Deployment Checklist — Beleqet

Companion to [STAGING_RUNBOOK.md](STAGING_RUNBOOK.md). The pipeline automates
every "verified by CI/CD" item; the rest are operator responsibilities.

## Pre-deployment

- [ ] PR reviewed and merged into `main` (never deploy from a PR or feature branch)
- [ ] CI run for the merge commit fully green (`ci-success`) — verified by CI/CD
- [ ] SHA-tagged images present in GHCR for that commit — verified by CI/CD
- [ ] `staging` environment secrets configured (names in runbook §6)
- [ ] No other deployment in progress (workflow concurrency + server lock enforce this)

## Database

- [ ] New migrations reviewed for destructive operations before merge
- [ ] Pre-migration `pg_dump` backup taken — automated, deployment aborts if it fails
- [ ] `prisma migrate deploy` is the only schema-change mechanism (no `db push`)
- [ ] After deploy: `prisma migrate status` clean if anything looked off

## Images

- [ ] Tags are the exact 40-character commit SHA — enforced by validation
- [ ] All three images pulled and verified present on the server — automated
- [ ] `:staging` alias only moves after verified health — automated

## Security

- [ ] No secrets in logs (validator and scripts print names only) — automated
- [ ] gitleaks scan green on the deployed commit — verified by CI/CD
- [ ] Trivy: no unfixed CRITICAL findings — verified by CI/CD
- [ ] SSH host key verified against `STAGING_KNOWN_HOSTS` — automated
- [ ] `.env.staging` permissions are `600`, owned by the deploy user

## Environment variables

- [ ] `.env.staging` complete (compose refuses to render otherwise) — automated
- [ ] No placeholder values (validator refuses placeholder secrets) — automated
- [ ] Staging uses sandbox/test payment keys only

## Health checks

- [ ] Backend `/api/v1/health/ready` returns 200 — automated gate
- [ ] Admin frontend responds 200 — automated gate
- [ ] Jobs frontend responds 200 — automated gate
- [ ] Runner-side verification of public URLs passed — automated

## Smoke tests

- [ ] `GET /api/v1/jobs/categories` returns data
- [ ] Admin frontend login page renders
- [ ] Jobs frontend home page renders

## Rollback readiness

- [ ] `.beleqet-last-successful-sha` exists and holds a valid SHA (first deploy: accepted risk — no rollback target yet)
- [ ] Previous SHA image still pullable/pinned locally — conservative prune keeps tagged images
- [ ] Database backup path known and readable

## Post-deployment verification

- [ ] Workflow summary shows the expected SHA
- [ ] `docker compose ps` shows every service `healthy`
- [ ] No error spikes in `compose logs --tail 200 backend`
- [ ] Deployed SHA recorded in the state file matches the merge commit
