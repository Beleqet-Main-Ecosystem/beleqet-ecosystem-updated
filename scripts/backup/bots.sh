#!/usr/bin/env bash
# Nightly backup of what the Telegram bots write: each bot's data/ folder (databases, saved
# conversations, uploads) and its .env, as /var/backups/beleqet/bots/bots-<date>-<time>.tar.gz,
# kept 14 days. The deploy installs it as /usr/local/sbin/beleqet-backup-bots; beleqet-backup.cron
# runs it. Restoring: bots/README.md.
set -Eeuo pipefail
umask 077

BOTS_ROOT=/opt/beleqet
DIR=/var/backups/beleqet/bots
KEEP_DAYS=14
trap 'echo "$(date "+%F %T") bots: FAILED at line $LINENO"' ERR

exec 9> /run/lock/beleqet-backup-bots.lock
if ! flock -n 9; then
  echo "$(date '+%F %T') bots: another backup is still running; skipped"
  exit 0
fi

mkdir -p "$DIR"
chmod 700 /var/backups/beleqet "$DIR"
FILE="$DIR/bots-$(date '+%Y%m%d-%H%M%S').tar.gz"
STAGE="$(mktemp -d)"
DBS=""
trap 'rm -rf "$STAGE" "$FILE.partial" ${DBS:+"$DBS"}' EXIT

# Copies each SQLite database in $1 into $2 (same relative paths) with SQLite's backup, which is
# consistent even while the bot writes, and checks the copy. Run as the bot's user, so the files
# SQLite may create next to a database stay the bot's.
COPY_DATABASES='
import os, sqlite3, sys
src_root, dst_root = sys.argv[1], sys.argv[2]
for folder, _, files in os.walk(src_root):
    for name in files:
        if not name.endswith(".db"):
            continue
        src_path = os.path.join(folder, name)
        dst_path = os.path.join(dst_root, os.path.relpath(src_path, src_root))
        os.makedirs(os.path.dirname(dst_path), exist_ok=True)
        src, dst = sqlite3.connect(src_path), sqlite3.connect(dst_path)
        src.backup(dst)
        src.close()
        if dst.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            sys.exit("integrity check failed: " + dst_path)
        dst.close()
'

bots=()
for data in "$BOTS_ROOT"/*/data; do
  [ -d "$data" ] || continue
  bot="$(basename "$(dirname "$data")")"
  owner="$(stat -c %U "$data")"
  mkdir -p "$STAGE/$bot"
  rsync -a --exclude='*.db' --exclude='*.db-*' "$data/" "$STAGE/$bot/data/"
  DBS="$(runuser -u "$owner" -- mktemp -d)"
  runuser -u "$owner" -- python3 -c "$COPY_DATABASES" "$data" "$DBS"
  cp -a "$DBS/." "$STAGE/$bot/data/"
  rm -rf "$DBS"
  DBS=""
  if [ -f "$BOTS_ROOT/$bot/.env" ]; then cp -a "$BOTS_ROOT/$bot/.env" "$STAGE/$bot/.env"; fi
  bots+=("$bot")
done
if [ "${#bots[@]}" -eq 0 ]; then
  echo "$(date '+%F %T') bots: FAILED, no $BOTS_ROOT/<bot>/data folder found"
  exit 1
fi

tar -czf "$FILE.partial" -C "$STAGE" "${bots[@]}"
gzip -t "$FILE.partial"
tar -tzf "$FILE.partial" > /dev/null
mv "$FILE.partial" "$FILE"

find "$DIR" -type f -name 'bots-*.tar.gz' -mtime +"$KEEP_DAYS" -delete
echo "$(date '+%F %T') bots: saved $FILE ($(du -h "$FILE" | cut -f1)): ${bots[*]}"
