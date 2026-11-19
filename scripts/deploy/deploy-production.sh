#!/usr/bin/env bash
# =============================================================================
# deploy-production.sh — put a CI-built commit live on the production server
#
# Usage (on the server, from the deploy directory):
#   sudo bash scripts/deploy/deploy-production.sh <40-char-git-sha>
#
# Production runs from /srv/beleqet with the repository's docker-compose.yml;
# its secrets come from the server-only, root-only .env next to it. CI publishes
# the API, admin and website images to GHCR for every commit on main, so the
# server pulls them instead of building (it lacks the disk space to build).
#
# Sequence: back up the database -> pull the images -> apply migrations with the
# new API image -> retag the images the compose services run -> restart the API,
# admin and website -> health checks -> install the nightly backup scripts -> update
# the Telegram bots. If a health check fails, the previous images come back
# automatically (migrations are not undone: they only ever add, so the previous code
# keeps working; restore the backup by hand if ever needed).
#
# The bots (bots/<name> in git) run from $BOTS_ROOT/<name> under systemd with their
# own .env, Python environment and data/ folder (everything they write), none of which
# are in git. Only their code is copied from this checkout; a bot restarts only when
# its code changed, and the files it replaced are kept in this deploy's backup folder.
# A bot's Mini App (bots/<name>/miniapp) is built here into miniapp/dist, which nginx serves.
# =============================================================================
set -Eeuo pipefail

SHA="${1:-}"
NAMESPACE="${IMAGE_NAMESPACE:-ghcr.io/beleqet-main-ecosystem/beleqet-ecosystem-updated}"
PROJECT="${COMPOSE_PROJECT:-beleqet}"
NETWORK="${COMPOSE_NETWORK:-${PROJECT}_default}"
BACKUP_ROOT="${BACKUP_ROOT:-/var/backups/beleqet/deploys}"
DB_CONTAINER="${DB_CONTAINER:-beleqet-db}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
MIN_FREE_GB="${MIN_FREE_GB:-5}"
KEEP_BACKUPS="${KEEP_BACKUPS:-10}"

# compose service -> GHCR image name (the running image is tagged $PROJECT-<service>:latest)
declare -A IMAGES=(
  [api]=beleqet-api
  [admin]=beleqet-admin
  [web]=beleqet-web
)
HEALTH_URLS=(
  "http://127.0.0.1:4000/api/v1/health"
  "http://127.0.0.1:3000/login"
  "http://127.0.0.1:3001/"
)

BOTS_ROOT="${BOTS_ROOT:-/opt/beleqet}"
# bots/<name> -> the systemd services that run it
declare -A BOT_SERVICES=(
  [jobs]="beleqet-jobs-bot"
  [boost]="beleqet-boost-bot beleqet-boost-api"
  [go]="beleqet-go-bot beleqet-go-api"
  [promo]="beleqet-promo-bot"
)
# Never copied: settings, the Python environment, data/ (everything a bot writes), the Mini App's
# packages and build, and tests. The database and pickle patterns are a safety net, should one
# ever be committed.
BOT_EXCLUDES=(
  --exclude='/data/' --exclude='.env*' --exclude='venv/' --exclude='__pycache__/' --exclude='*.pyc'
  --exclude='*.db' --exclude='*.db-*' --exclude='*.sqlite*' --exclude='*.pickle'
  --exclude='*.log' --exclude='*.bak*' --exclude='test_*.py' --exclude='tests/'
  --exclude='node_modules/' --exclude='/miniapp/dist/' --exclude='/miniapp/dist.new/'
)
# Where each bot's data was before it all moved into its data/ folder (Nov 2026), as
# "old path:new name in data/". A deploy moves what is still there while the bot is stopped;
# once moved, there is nothing left to do.
declare -A OLD_DATA=(
  [boost]="referrals.db:boost.db bot_persistence:persistence.pickle"
  [go]="referrals.db:go.db bot_persistence:persistence.pickle"
  [jobs]="bot_data.pickle:persistence.pickle sgs_challenge.db:sgs-challenge.db sgs-challenge/app/uploads:sgs-challenge-uploads"
  [promo]="database.db:promo.db uploads:uploads"
)
# The nightly backups (scripts/backup) -> where they are installed, and their mode.
BACKUP_SCRIPTS=(
  "scripts/backup/db.sh:/usr/local/sbin/beleqet-backup-db:700"
  "scripts/backup/bots.sh:/usr/local/sbin/beleqet-backup-bots:700"
  "scripts/backup/beleqet-backup.cron:/etc/cron.d/beleqet-backup:644"
)

log() { printf '[deploy] %s %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "give the full 40-character commit SHA to deploy"
[ -f docker-compose.yml ] && [ -f .env ] || fail "run this from the production deploy directory"

# Keeps only what a deploy needs. Every release used to leave about 4 GB behind until the disk filled.
#   cleanup_images all-rollbacks  before pulling: the running images (latest) and the target version.
#                                 The running version becomes this deploy's rollback, so older ones
#                                 are never used.
#   cleanup_images newest         after a successful deploy: also the rollback set just made.
cleanup_images() {
  local service tag keep=""
  for service in "${!IMAGES[@]}"; do
    if [ "$1" = newest ]; then
      keep="$(docker images --format '{{.Tag}}' "$PROJECT-$service" | grep '^rollback-' | sort | tail -1 || true)"
    fi
    for tag in $(docker images --format '{{.Tag}}' "$PROJECT-$service" | grep '^rollback-' || true); do
      [ "$tag" = "$keep" ] || docker rmi "$PROJECT-$service:$tag" > /dev/null 2>&1 || true
    done
    # Untagging a version still used by latest or the rollback keeps its layers.
    for tag in $(docker images --format '{{.Tag}}' "$NAMESPACE/${IMAGES[$service]}" || true); do
      [ "$tag" = "$SHA" ] || docker rmi "$NAMESPACE/${IMAGES[$service]}:$tag" > /dev/null 2>&1 || true
    done
  done
  docker image prune -f > /dev/null 2>&1 || true
}

free_gb() {
  df -BG --output=avail / | tail -1 | tr -dc '0-9'
}

# The API's database URL exactly as compose gives it to the container (from .env).
database_url() {
  docker compose config --format json |
    python3 -c 'import json, sys; print(json.load(sys.stdin)["services"]["api"]["environment"]["DATABASE_URL"])'
}

services_active() {
  local unit
  for unit in "$@"; do systemctl is-active --quiet "$unit" || return 1; done
}

# Moves a stopped bot's data from its old place (OLD_DATA) into data/, a database together with
# its -wal/-shm/-journal files, and records each move in MOVED for undo_data_moves.
MOVED=()
move_old_data() {
  local bot=$1 dir=$2 owner=$3 pair from to ext
  MOVED=()
  mkdir -p "$dir/data"
  chown "$owner" "$dir/data"
  for pair in ${OLD_DATA[$bot]:-}; do
    from="$dir/${pair%%:*}"
    to="$dir/data/${pair##*:}"
    [ -e "$from" ] || continue
    if [ -e "$to" ]; then
      # Made by the new code before the move (a crash restart in between); the real data wins.
      mv "$to" "$to.replaced-$STAMP"
      log "    $bot: kept the new data/${pair##*:} aside as data/${pair##*:}.replaced-$STAMP"
    fi
    for ext in "" -wal -shm -journal; do
      if [ -e "$from$ext" ]; then
        mv "$from$ext" "$to$ext"
        MOVED+=("$from$ext|$to$ext")
      fi
    done
    log "    $bot: ${pair%%:*} -> data/${pair##*:}"
  done
}

undo_data_moves() {
  local move
  for move in "${MOVED[@]}"; do mv "${move#*|}" "${move%%|*}"; done
}

install_backup_scripts() {
  local entry src dest mode updated=""
  for entry in "${BACKUP_SCRIPTS[@]}"; do
    IFS=: read -r src dest mode <<< "$entry"
    cmp -s "$src" "$dest" && continue
    install -m "$mode" -o root -g root "$src" "$dest"
    updated+=" ${dest##*/}"
  done
  log "    ${updated:+updated:$updated}${updated:-unchanged}"
}

# Builds a bot's Mini App as the bot's user. The new build replaces the one nginx serves only once
# it has succeeded; node_modules goes afterwards (it's only needed to build).
build_miniapp() {
  local bot=$1 app=$2/miniapp user=${3%%:*}
  log "    $bot: building its Mini App"
  rm -rf "$app/dist.new"
  # shellcheck disable=SC2016 # expanded by the inner shell
  if sudo -u "$user" -H NPM_CONFIG_UPDATE_NOTIFIER=false sh -c 'cd "$1" && npm ci --no-audit --no-fund --loglevel=error && npm run build -- --outDir dist.new' \
    sh "$app" > /dev/null; then
    rm -rf "$app/dist" "$app/node_modules"
    mv "$app/dist.new" "$app/dist"
    return 0
  fi
  log "    $bot: its Mini App didn't build; the previous build stays"
  rm -rf "$app/dist.new" "$app/node_modules"
  return 1
}

# Copies each bot's code into place and restarts the bots whose code changed, moving their data
# into data/ on the way if it's still in its old place. A bot that doesn't come back up gets its
# previous files (and data in its old place) back. Returns non-zero if any bot needed that.
deploy_bots() {
  local bot dir owner changes failed=0
  for bot in "${!BOT_SERVICES[@]}"; do
    dir="$BOTS_ROOT/$bot"
    if [ ! -d "bots/$bot" ] || [ ! -d "$dir" ]; then
      log "    $bot: not set up on this server, skipped"
      continue
    fi
    owner="$(stat -c %U:%G "$dir")"
    changes="$(rsync -rlci --chown="$owner" --backup --backup-dir="$BACKUP_ROOT/$STAMP/bots/$bot" \
      "${BOT_EXCLUDES[@]}" "bots/$bot/" "$dir/" | grep '^>f' || true)"
    if [ -f "$dir/miniapp/package.json" ] && { grep -q ' miniapp/' <<< "$changes" || [ ! -d "$dir/miniapp/dist" ]; }; then
      build_miniapp "$bot" "$dir" "$owner" || failed=1
    fi
    if [ -z "$changes" ]; then
      log "    $bot: unchanged"
      continue
    fi
    log "    $bot: $(wc -l <<< "$changes") file(s) updated"
    if ! grep -qv ' miniapp/' <<< "$changes"; then
      continue  # only the Mini App changed: nginx serves the new build, the bot keeps running
    fi
    if grep -q ' requirements.txt$' <<< "$changes"; then
      # Unpinned names: installs what's missing, never upgrades or downgrades what's there.
      sudo -u "${owner%%:*}" "$dir/venv/bin/pip" install -q -r "$dir/requirements.txt" ||
        log "    $bot: installing its Python packages failed"
    fi
    # shellcheck disable=SC2086 # one or more service names
    systemctl stop ${BOT_SERVICES[$bot]}
    move_old_data "$bot" "$dir" "$owner"
    # shellcheck disable=SC2086
    systemctl start ${BOT_SERVICES[$bot]}
    sleep 5
    # shellcheck disable=SC2086
    if ! services_active ${BOT_SERVICES[$bot]}; then
      log "    $bot did not start; putting its previous files back"
      # shellcheck disable=SC2086
      systemctl stop ${BOT_SERVICES[$bot]}
      cp -a "$BACKUP_ROOT/$STAMP/bots/$bot/." "$dir/" 2> /dev/null || true
      undo_data_moves
      # shellcheck disable=SC2086
      systemctl start ${BOT_SERVICES[$bot]}
      failed=1
    fi
  done
  return "$failed"
}

log "1/8 backing up the database"
mkdir -p "$BACKUP_ROOT/$STAMP" && chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT/$STAMP"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_ROOT/$STAMP/database.dump"
[ -s "$BACKUP_ROOT/$STAMP/database.dump" ] || fail "database backup is empty"
log "    saved $BACKUP_ROOT/$STAMP/database.dump"

log "2/8 pulling images for $SHA"
cleanup_images all-rollbacks
if [ "$(free_gb)" -lt "$MIN_FREE_GB" ]; then
  fail "only $(free_gb) GB free on / (need $MIN_FREE_GB GB); nothing was changed. Free space, then deploy again"
fi
for service in "${!IMAGES[@]}"; do
  docker pull -q "$NAMESPACE/${IMAGES[$service]}:$SHA" > /dev/null
done

log "3/8 applying database migrations"
docker run --rm --network "$NETWORK" -e DATABASE_URL="$(database_url)" \
  "$NAMESPACE/${IMAGES[api]}:$SHA" ./node_modules/.bin/prisma migrate deploy

log "4/8 keeping the running images as rollback-$STAMP and switching to $SHA"
for service in "${!IMAGES[@]}"; do
  docker tag "$PROJECT-$service:latest" "$PROJECT-$service:rollback-$STAMP" 2>/dev/null || true
  docker tag "$NAMESPACE/${IMAGES[$service]}:$SHA" "$PROJECT-$service:latest"
done

restart() {
  docker compose up -d --no-deps --no-build "${!IMAGES[@]}"
}

healthy() {
  local url code
  for url in "${HEALTH_URLS[@]}"; do
    for _ in $(seq 1 30); do
      code="$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)"
      [ "$code" = 200 ] && break
      sleep 4
    done
    [ "$code" = 200 ] || { log "    $url answered $code"; return 1; }
  done
}

log "5/8 restarting the API, admin and website"
restart

log "6/8 health checks"
if healthy; then
  echo "$SHA" > .beleqet-production-sha
  cleanup_images newest
  # Automatic backups (named by timestamp) beyond the newest $KEEP_BACKUPS go; hand-made ones stay.
  find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -regextype posix-extended -regex '.*/[0-9]{8}-[0-9]{6}'     | sort | head -n -"$KEEP_BACKUPS" | xargs -r rm -rf
  log "live: $SHA (rollback images tagged rollback-$STAMP, $(free_gb) GB free)"
  log "7/8 installing the nightly backup scripts"
  install_backup_scripts
  log "8/8 updating the Telegram bots"
  deploy_bots || fail "the API, admin and website are live, but a bot didn't start with the new code (it was put back) or its Mini App didn't build; see above"
  exit 0
fi

log "health check failed; putting the previous images back"
for service in "${!IMAGES[@]}"; do
  docker tag "$PROJECT-$service:rollback-$STAMP" "$PROJECT-$service:latest" 2>/dev/null || true
done
restart
if healthy; then
  log "previous version restored"
else
  log "previous version is not healthy either; check the containers now"
fi
exit 1
