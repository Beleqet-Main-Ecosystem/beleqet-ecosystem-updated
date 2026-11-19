# scripts

Repository-wide tooling, run from the repository root. Each app keeps its own scripts
(`apps/api/scripts/`, `apps/mobile/scripts/`). Anything else you put in `scripts/` is ignored by
git (see `.gitignore`), so local one-off tools don't end up in the repository.

| Path | What it is | Used by |
|---|---|---|
| `backup/` | The nightly backups of the main database and of the bots' data, and their schedule | the server's cron; the deploy installs them |
| `ci/` | CI helpers: the synthetic test environment, compose checks, the dependency audit gate | `.github/workflows/ci.yml` |
| `deploy/` | Production deploy (including the bots and the backup scripts), migrations and health checks | `.github/workflows/deploy-production.yml` |

## Backups

Every deploy installs `backup/db.sh` and `backup/bots.sh` on the server as `beleqet-backup-db` and
`beleqet-backup-bots` (in `/usr/local/sbin`), and `backup/beleqet-backup.cron` as
`/etc/cron.d/beleqet-backup`. Every night (UTC) they write, root only, kept 14 days:

| When | What | Where |
|---|---|---|
| 02:00 | the main database (`beleqet-db`) | `/var/backups/beleqet/db/db-<date>-<time>.sql.gz` |
| 02:30 | each bot's `data/` folder and `.env` | `/var/backups/beleqet/bots/bots-<date>-<time>.tar.gz` |
| every deploy | the main database, before migrating it | `/var/backups/beleqet/deploys/<stamp>/database.dump` (newest 10) |

Their log is `/var/log/beleqet-backup.log`. To run one now: `sudo beleqet-backup-db` or `sudo beleqet-backup-bots`.

Restoring the main database replaces everything in it, so stop the API first:

```bash
cd /srv/beleqet && sudo docker compose stop api
gunzip -c /var/backups/beleqet/db/db-20261120-020001.sql.gz |
  sudo docker exec -i beleqet-db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE \"$POSTGRES_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$POSTGRES_DB\"" && psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1'
sudo docker compose start api
```

Restoring a bot's data: `bots/README.md`, section 15.
