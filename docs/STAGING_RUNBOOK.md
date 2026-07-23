# Staging Runbook — Beleqet

Operational guide for the staging server behind
`.github/workflows/deploy-staging.yml`. Pipeline design is in
[CI_CD_PIPELINE.md](CI_CD_PIPELINE.md).

---

## 1. Server prerequisites

- Linux host (x86_64) reachable over SSH.
- Docker Engine ≥ 24 with the Compose plugin (`docker compose version`).
- `bash`, `curl`, `gzip` (standard on any mainstream distro).
- Outbound HTTPS to `ghcr.io`.
- Enough disk for images + Postgres volume + backups (≥ 20 GB recommended).

## 2. Dedicated deployment user

```bash
sudo useradd -m -s /bin/bash beleqet-deploy
sudo usermod -aG docker beleqet-deploy
```

Use this account for deployments only. Add the deploy public key to
`/home/beleqet-deploy/.ssh/authorized_keys` (generate a dedicated ed25519
keypair; the private half becomes the `STAGING_SSH_PRIVATE_KEY` secret).

## 3. Required directories

```bash
sudo mkdir -p /srv/beleqet-staging
sudo chown beleqet-deploy:beleqet-deploy /srv/beleqet-staging
```

`/srv/beleqet-staging` is the `STAGING_DEPLOY_PATH`. The workflow copies
`docker-compose.staging.yml` and `scripts/deploy/` into it on every deploy;
the server keeps `.env.staging`, `.env.images`, `backups/`, `deploy-logs/`,
and the state file `.beleqet-last-successful-sha` there.

## 4. GitHub Container Registry authentication

Create a GitHub personal access token with **read:packages only** (fine-grained
or classic). It becomes `GHCR_TOKEN` inside `.env.staging` on the server and
the `STAGING_GHCR_TOKEN` secret. The deploy script logs in with
`--password-stdin`; nothing is echoed.

## 5. `.env.staging` creation

```bash
# on the server, as beleqet-deploy
cd /srv/beleqet-staging
# copy .env.staging.example from the repository, then fill every value
chmod 600 .env.staging
```

Rules:

- Generate secrets with `openssl rand -hex 64` (keys: `-hex 32`).
- Use sandbox/test payment keys only.
- Never commit the filled file anywhere.
- `docker-compose.staging.yml` refuses to render if a required variable is
  missing, and the deploy script refuses placeholder-looking secrets.

## 6. GitHub Environment and secrets

Create the **`staging`** environment in the repository
(Settings → Environments). Recommended: add required reviewers so every
deployment needs approval. Configure these environment secrets:

```text
STAGING_HOST                 hostname or IP of the staging server
STAGING_PORT                 SSH port (e.g. 22)
STAGING_USER                 beleqet-deploy
STAGING_SSH_PRIVATE_KEY      private key for the deploy user (ed25519)
STAGING_KNOWN_HOSTS          output of: ssh-keyscan -p <port> <host>
STAGING_DEPLOY_PATH          /srv/beleqet-staging
STAGING_BACKEND_HEALTH_URL   public URL of /api/v1/health/ready
STAGING_ADMIN_HEALTH_URL     public URL of the admin frontend
STAGING_JOBS_HEALTH_URL      public URL of the jobs frontend
STAGING_GHCR_USERNAME        GitHub username for GHCR pulls
STAGING_GHCR_TOKEN           read:packages token
```

Secret **values** are never printed by any pipeline step; validation reports
names only.

## 7. Known-host configuration

```bash
ssh-keyscan -p 22 staging.example.com
```

Paste the full output into `STAGING_KNOWN_HOSTS`. The workflow writes it to
`~/.ssh/known_hosts` and connects with `StrictHostKeyChecking=yes` — if the
host key ever changes, deployment fails loudly instead of trusting the new
key. Re-run `ssh-keyscan` and update the secret only after verifying the
change is legitimate.

## 8. Deployments

### Initial deployment

1. Complete §1–§7.
2. Merge a PR into `main` (or run **Deploy Staging** manually with
   `dry_run=false` from `main`).
3. First run detects no running database, starts db/redis first, applies all
   migrations, then starts the full stack.
4. Verify: `curl -fsS <STAGING_BACKEND_HEALTH_URL>` returns `{"status":"ok",…}`.

### Normal deployment

Automatic: merge to `main` → CI green → images pushed → deploy workflow runs
the sequence in CI_CD_PIPELINE.md §6. Watch the run's summary for the deployed
SHA.

### Dry run

Actions → **Deploy Staging** → Run workflow → `dry_run=true`. Validates
configuration, resolves the SHA, builds images, prints the plan — contacts no
server, changes nothing.

## 9. Failure handling

### Failed deployment (health check)

Containers were rolled back to the previous SHA automatically (if one was
recorded). On the server:

```bash
cd /srv/beleqet-staging
cat .beleqet-last-successful-sha        # what is running now
ls deploy-logs/                          # ps-/logs- snapshots from the failure
docker compose --env-file .env.staging --env-file .env.images \
  -f docker-compose.staging.yml ps
```

### Failed migration

Services were **not** restarted; the previous release is still running.

```bash
docker compose --env-file .env.staging --env-file .env.images \
  -f docker-compose.staging.yml run --rm --no-deps backend ./node_modules/.bin/prisma migrate status
```

Fix forward with a corrective migration in a new PR. Restore from backup only
for destructive damage (below).

### Stale lock

If a deploy crashed hard, `.beleqet-deploy.lock` may remain. Confirm no
deployment is actually running (`ps aux | grep deploy-staging`), then:

```bash
rmdir /srv/beleqet-staging/.beleqet-deploy.lock
```

## 10. Container rollback (manual)

```bash
cd /srv/beleqet-staging
bash scripts/deploy/rollback.sh <currently-failing-sha>
```

Selects the last recorded healthy SHA, restarts the stack on it, re-checks
backend health. Refuses to run without a valid, distinct recorded SHA.

## 11. Database backup handling

- Written to `backups/backup-<UTC>-pre-<sha>.sql.gz` before every migration.
- Restore (destructive — take a fresh dump of the current state first):

```bash
gunzip -c backups/backup-<...>.sql.gz | \
  docker compose --env-file .env.staging --env-file .env.images \
    -f docker-compose.staging.yml exec -T db psql -U "$STAGING_DB_USER" "$STAGING_DB_NAME"
```

- Prune old backups periodically (e.g. keep 14 days); they contain staging
  data and belong on encrypted storage if copied off-host.

## 12. Log inspection

```bash
docker compose --env-file .env.staging --env-file .env.images \
  -f docker-compose.staging.yml logs --tail 200 backend
```

Same for `admin-frontend`, `jobs-frontend`, `db`, `redis`. Deployment-time
snapshots live in `deploy-logs/`.

## 13. Emergency stop

```bash
cd /srv/beleqet-staging
docker compose --env-file .env.staging --env-file .env.images \
  -f docker-compose.staging.yml down
```

(Data volumes survive `down`; never use `down -v` unless you intend to delete
the staging database and Redis data.)

## 14. Recovery from a stopped stack

```bash
cd /srv/beleqet-staging
bash scripts/deploy/deploy-staging.sh "$(cat .beleqet-last-successful-sha)"
```

Re-runs the full sequence (including a fresh backup) for the last known-good
SHA.
