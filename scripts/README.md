# scripts

Repository-wide tooling, run from the repository root. Each app keeps its own scripts
(`apps/api/scripts/`, `apps/mobile/scripts/`). Anything else you put in `scripts/` is ignored by
git (see `.gitignore`), so local one-off tools don't end up in the repository.

| Path | What it is | Used by |
|---|---|---|
| `ci/` | CI helpers: the synthetic test environment, compose checks, the dependency audit gate | `.github/workflows/ci.yml` |
| `deploy/` | Production deploy (including the bots), migrations, backups and health checks | `.github/workflows/deploy-production.yml` |
