#!/usr/bin/env bash
# =============================================================================
# deploy-production.sh — put a CI-built commit live on the production server
#
# Usage (on the server, from the deploy directory):
#   sudo bash scripts/deploy/deploy-production.sh <40-char-git-sha>
#
# Production runs from /srv/beleqet-staging with docker-compose.yml plus the
# server-only docker-compose.override.yml; neither is replaced here. CI publishes
# the API, admin and website images to GHCR for every commit on main, so the
# server pulls them instead of building (it lacks the disk space to build).
#
# Sequence: back up the database -> pull the images -> apply migrations with the
# new API image -> retag the images the compose services run -> restart the API,
# admin and website -> health checks. If a health check fails, the previous
# images come back automatically (migrations are not undone: they only ever add,
# so the previous code keeps working; restore the backup by hand if ever needed).
# =============================================================================
set -Eeuo pipefail

SHA="${1:-}"
NAMESPACE="${IMAGE_NAMESPACE:-ghcr.io/beleqet-main-ecosystem/beleqet-ecosystem-updated}"
PROJECT="${COMPOSE_PROJECT:-beleqet-staging}"
NETWORK="${COMPOSE_NETWORK:-${PROJECT}_default}"
BACKUP_ROOT="${BACKUP_ROOT:-/srv/backups}"
DB_CONTAINER="${DB_CONTAINER:-beleqet2-postgres}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"

# compose service -> GHCR image name
declare -A IMAGES=(
  [backend]=beleqet-backend
  [frontend]=beleqet-admin-frontend
  [jobs-frontend]=beleqet-jobs-frontend
)
HEALTH_URLS=(
  "http://127.0.0.1:4000/api/v1/health"
  "http://127.0.0.1:3000/login"
  "http://127.0.0.1:3001/"
)

log() { printf '[deploy] %s %s\n' "$(date -u +%H:%M:%S)" "$*"; }
fail() { log "ERROR: $*"; exit 1; }

[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || fail "give the full 40-character commit SHA to deploy"
[ -f docker-compose.yml ] && [ -f docker-compose.override.yml ] || fail "run this from the production deploy directory"

database_url() {
  grep -oE 'DATABASE_URL=postgresql://[^ ]+' docker-compose.override.yml | head -1 | cut -d= -f2-
}

log "1/6 backing up the database"
mkdir -p "$BACKUP_ROOT/$STAMP" && chmod 700 "$BACKUP_ROOT" "$BACKUP_ROOT/$STAMP"
docker exec "$DB_CONTAINER" sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "$BACKUP_ROOT/$STAMP/database.dump"
[ -s "$BACKUP_ROOT/$STAMP/database.dump" ] || fail "database backup is empty"
log "    saved $BACKUP_ROOT/$STAMP/database.dump"

log "2/6 pulling images for $SHA"
for service in "${!IMAGES[@]}"; do
  docker pull -q "$NAMESPACE/${IMAGES[$service]}:$SHA" > /dev/null
done

log "3/6 applying database migrations"
docker run --rm --network "$NETWORK" -e DATABASE_URL="$(database_url)" \
  "$NAMESPACE/beleqet-backend:$SHA" ./node_modules/.bin/prisma migrate deploy

log "4/6 keeping the running images as rollback-$STAMP and switching to $SHA"
for service in "${!IMAGES[@]}"; do
  docker tag "$PROJECT-$service:latest" "$PROJECT-$service:rollback-$STAMP" 2>/dev/null || true
  docker tag "$NAMESPACE/${IMAGES[$service]}:$SHA" "$PROJECT-$service:latest"
done

restart() {
  docker compose up -d --no-deps --no-build backend frontend jobs-frontend
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

log "5/6 restarting the API, admin and website"
restart

log "6/6 health checks"
if healthy; then
  echo "$SHA" > .beleqet-production-sha
  log "live: $SHA (rollback images tagged rollback-$STAMP)"
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
