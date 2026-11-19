#!/usr/bin/env bash
# Nightly backup of the main database (the beleqet-db container) into /var/backups/beleqet/db,
# kept 14 days. The deploy installs it as /usr/local/sbin/beleqet-backup-db; beleqet-backup.cron
# runs it. Restoring: scripts/README.md.
set -Eeuo pipefail
umask 077

DIR=/var/backups/beleqet/db
CONTAINER=beleqet-db
KEEP_DAYS=14
trap 'echo "$(date "+%F %T") db: FAILED at line $LINENO"' ERR

# One run at a time: two runs started in the same second once wrote into the same file and corrupted it.
exec 9> /run/lock/beleqet-backup-db.lock
if ! flock -n 9; then
  echo "$(date '+%F %T') db: another backup is still running; skipped"
  exit 0
fi

mkdir -p "$DIR"
chmod 700 /var/backups/beleqet "$DIR"
FILE="$DIR/db-$(date '+%Y%m%d-%H%M%S').sql.gz"
PARTIAL="$FILE.partial"
trap 'rm -f "$PARTIAL"' EXIT

# Written under another name and renamed once checked, so an unfinished file never looks like a backup.
docker exec "$CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB"' | gzip > "$PARTIAL"
gzip -t "$PARTIAL"
if ! zcat "$PARTIAL" | tail -n 5 | grep -q 'PostgreSQL database dump complete'; then
  echo "$(date '+%F %T') db: FAILED, the dump is incomplete"
  exit 1
fi
mv "$PARTIAL" "$FILE"

find "$DIR" -type f -name 'db-*.sql.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') db: saved $FILE ($(du -h "$FILE" | cut -f1))"
