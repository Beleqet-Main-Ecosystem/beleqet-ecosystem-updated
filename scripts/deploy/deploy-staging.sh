#!/usr/bin/env bash
# =============================================================================
# deploy-staging.sh — promote a commit-SHA-tagged image set on the staging host
#
# Usage: deploy-staging.sh <40-char-git-sha>
#
# Runs in the staging deployment directory (containing docker-compose.staging.yml
# and .env.staging). Invoked over SSH by .github/workflows/deploy-staging.yml,
# or directly for a local staging simulation.
#
# Sequence: validate → lock → record current SHA → write image refs → pull →
# verify → DB backup → migrate (once) → up → bounded health checks → record
# success. On a failed health check: capture sanitized logs, roll containers
# back to the last recorded healthy SHA, and exit non-zero.
#
# Exit codes: 0 ok · 1 validation/config · 2 lock held · 3 migration failed ·
# 4 health check failed (rollback attempted) · 5 image pull failed
#
# Environment (from .env.staging, see .env.staging.example):
#   IMAGE_NAMESPACE            e.g. ghcr.io/<owner>/<repo>
#   GHCR_REGISTRY GHCR_USERNAME GHCR_TOKEN   (login skipped when
#                              SKIP_REGISTRY_LOGIN=1, e.g. local simulation)
#   HEALTH_URL_BACKEND HEALTH_URL_ADMIN HEALTH_URL_JOBS
#   STAGING_DB_USER STAGING_DB_NAME          (for the pre-migration backup)
# Optional:
#   COMPOSE_FILE_PATH (default docker-compose.staging.yml)
#   ENV_FILE_PATH     (default .env.staging)
#   BACKUP_DIR        (default ./backups)
#   HEALTH_MAX_ATTEMPTS (default 20)  HEALTH_RETRY_DELAY (default 5 seconds)
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-docker-compose.staging.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-.env.staging}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
STATE_FILE="${STATE_FILE:-.beleqet-last-successful-sha}"
LOCK_DIR="${LOCK_DIR:-.beleqet-deploy.lock}"
LOG_DIR="${LOG_DIR:-./deploy-logs}"
IMAGES_ENV_FILE="${IMAGES_ENV_FILE:-.env.images}"
HEALTH_MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-20}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-5}"

TARGET_SHA="${1:-}"
LOCK_ACQUIRED=0

log() { printf '[deploy] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }
fail() {
  log "ERROR: $1"
  exit "${2:-1}"
}

release_lock() {
  if [ "$LOCK_ACQUIRED" -eq 1 ]; then
    rmdir "$LOCK_DIR" 2>/dev/null || true
    LOCK_ACQUIRED=0
  fi
}

on_unexpected_error() {
  local line="$1"
  log "ERROR: unexpected failure at line ${line}; releasing lock and aborting"
  release_lock
}
trap 'on_unexpected_error $LINENO' ERR
trap 'release_lock' EXIT

compose() {
  docker compose --env-file "$ENV_FILE_PATH" --env-file "$IMAGES_ENV_FILE" \
    -f "$COMPOSE_FILE_PATH" "$@"
}

# ── 1. Validate configuration ────────────────────────────────────────────────
command -v docker >/dev/null 2>&1 || fail "docker is not installed or not on PATH"

case "$TARGET_SHA" in
  *[!0-9a-f]* | '') fail "usage: deploy-staging.sh <40-char-git-sha> (got an invalid value)" ;;
esac
[ "${#TARGET_SHA}" -eq 40 ] || fail "target SHA must be exactly 40 hex characters"

[ -f "$COMPOSE_FILE_PATH" ] || fail "compose file not found: $COMPOSE_FILE_PATH"
[ -f "$ENV_FILE_PATH" ] || fail "environment file not found: $ENV_FILE_PATH"

# Load staging configuration for the variables this script itself needs.
# shellcheck disable=SC1090
set -a && . "$ENV_FILE_PATH" && set +a

: "${IMAGE_NAMESPACE:?IMAGE_NAMESPACE must be set in ${ENV_FILE_PATH}}"
: "${HEALTH_URL_BACKEND:?HEALTH_URL_BACKEND must be set in ${ENV_FILE_PATH}}"
: "${HEALTH_URL_ADMIN:?HEALTH_URL_ADMIN must be set in ${ENV_FILE_PATH}}"
: "${HEALTH_URL_JOBS:?HEALTH_URL_JOBS must be set in ${ENV_FILE_PATH}}"

case "$IMAGE_NAMESPACE" in
  *[!0-9a-z./_-]*) fail "IMAGE_NAMESPACE contains characters outside [0-9a-z./_-]" ;;
esac

# ── 2. Acquire deployment lock (one deployment at a time) ────────────────────
if mkdir "$LOCK_DIR" 2>/dev/null; then
  LOCK_ACQUIRED=1
  log "acquired deployment lock"
else
  fail "another deployment appears to be in progress (lock: $LOCK_DIR)" 2
fi

mkdir -p "$BACKUP_DIR" "$LOG_DIR"

# ── 3. Record the currently deployed SHA (rollback target) ───────────────────
PREVIOUS_SHA=""
if [ -f "$STATE_FILE" ]; then
  PREVIOUS_SHA="$(tr -d '[:space:]' <"$STATE_FILE")"
  log "previous successful deployment: ${PREVIOUS_SHA:-<none>}"
else
  log "no previous successful deployment recorded"
fi

# ── 4. Write exact image references for this deployment ──────────────────────
{
  printf 'BACKEND_IMAGE=%s/beleqet-backend:%s\n' "$IMAGE_NAMESPACE" "$TARGET_SHA"
  printf 'ADMIN_IMAGE=%s/beleqet-admin-frontend:%s\n' "$IMAGE_NAMESPACE" "$TARGET_SHA"
  printf 'JOBS_IMAGE=%s/beleqet-jobs-frontend:%s\n' "$IMAGE_NAMESPACE" "$TARGET_SHA"
} >"$IMAGES_ENV_FILE"
log "image set pinned to SHA $TARGET_SHA"

# ── 5. Registry login + pull + verify ────────────────────────────────────────
if [ "${SKIP_REGISTRY_LOGIN:-0}" != "1" ]; then
  : "${GHCR_REGISTRY:?GHCR_REGISTRY must be set in ${ENV_FILE_PATH}}"
  : "${GHCR_USERNAME:?GHCR_USERNAME must be set in ${ENV_FILE_PATH}}"
  : "${GHCR_TOKEN:?GHCR_TOKEN must be set in ${ENV_FILE_PATH}}"
  printf '%s' "$GHCR_TOKEN" | docker login "$GHCR_REGISTRY" \
    --username "$GHCR_USERNAME" --password-stdin >/dev/null ||
    fail "registry login failed (credentials not printed)" 5
  log "registry login OK"
fi

if [ "${SKIP_IMAGE_PULL:-0}" != "1" ]; then
  compose pull backend admin-frontend jobs-frontend ||
    fail "image pull failed for SHA $TARGET_SHA" 5
fi

for service_image in \
  "$IMAGE_NAMESPACE/beleqet-backend:$TARGET_SHA" \
  "$IMAGE_NAMESPACE/beleqet-admin-frontend:$TARGET_SHA" \
  "$IMAGE_NAMESPACE/beleqet-jobs-frontend:$TARGET_SHA"; do
  docker image inspect "$service_image" >/dev/null 2>&1 ||
    fail "image not present after pull: $service_image" 5
done
log "all three images verified locally"

# ── 6. Database backup (before any migration) ────────────────────────────────
BACKUP_FILE=""
if compose ps --status running db 2>/dev/null | grep -q db; then
  BACKUP_FILE="$BACKUP_DIR/backup-$(date -u +%Y%m%dT%H%M%SZ)-pre-${TARGET_SHA}.sql.gz"
  if compose exec -T db pg_dump -U "${STAGING_DB_USER:?}" "${STAGING_DB_NAME:?}" |
    gzip >"$BACKUP_FILE"; then
    log "database backup written: $BACKUP_FILE"
  else
    rm -f "$BACKUP_FILE"
    fail "database backup failed; refusing to migrate without a backup" 3
  fi
else
  log "db service not running yet (first deployment?) — starting db/redis before migration"
  compose up -d db redis
fi

# ── 7. Apply migrations exactly once ─────────────────────────────────────────
if ! "$SCRIPT_DIR/migrate.sh"; then
  log "migration FAILED — services were not restarted; previous release keeps running"
  [ -n "$BACKUP_FILE" ] && log "pre-migration backup preserved at: $BACKUP_FILE"
  log "manual recovery: inspect 'prisma migrate status'; restore the backup only if needed"
  exit 3
fi

# ── 8. Start the updated services ────────────────────────────────────────────
compose up -d --remove-orphans
log "services started for SHA $TARGET_SHA"

# ── 9. Bounded health checks ─────────────────────────────────────────────────
health_failed=""
for check in \
  "backend|$HEALTH_URL_BACKEND" \
  "admin-frontend|$HEALTH_URL_ADMIN" \
  "jobs-frontend|$HEALTH_URL_JOBS"; do
  name="${check%%|*}"
  url="${check#*|}"
  if "$SCRIPT_DIR/health-check.sh" "$url" "$HEALTH_MAX_ATTEMPTS" "$HEALTH_RETRY_DELAY"; then
    log "health OK: $name"
  else
    log "health FAILED: $name"
    health_failed="$name"
    break
  fi
done

if [ -n "$health_failed" ]; then
  # ── Failure path: capture diagnostics, then roll containers back ───────────
  ts="$(date -u +%Y%m%dT%H%M%SZ)"
  compose ps >"$LOG_DIR/ps-$ts.txt" 2>&1 || true
  compose logs --tail 200 >"$LOG_DIR/logs-$ts.txt" 2>&1 || true
  log "diagnostics preserved under $LOG_DIR (ps/logs at $ts)"
  [ -n "$BACKUP_FILE" ] && log "pre-migration backup preserved at: $BACKUP_FILE"
  log "database was NOT rolled back automatically (migrations are roll-forward only)"

  if "$SCRIPT_DIR/rollback.sh" "$TARGET_SHA"; then
    log "container rollback to previous SHA succeeded"
  else
    log "container rollback was not possible — manual intervention required"
  fi
  exit 4
fi

# ── 10-12. Record success ────────────────────────────────────────────────────
printf '%s\n' "$TARGET_SHA" >"$STATE_FILE"
log "recorded successful deployment SHA"

# Conservative cleanup: only dangling layers, never tagged images (rollback
# targets must remain pullable locally).
docker image prune -f >/dev/null 2>&1 || true

release_lock
log "deployment complete: $TARGET_SHA"
