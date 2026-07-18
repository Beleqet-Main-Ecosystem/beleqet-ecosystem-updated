#!/usr/bin/env bash
# =============================================================================
# rollback.sh — restore the previous healthy container image set
#
# Usage: rollback.sh <failing-sha>
#
# Reads the last recorded successful SHA, validates it (full 40-hex, distinct
# from the failing SHA — same rules as tools/ci/rollback.ts), rewrites the
# image references, restarts the stack, and re-checks backend health.
#
# CONTAINERS ONLY: the database is never rolled back here. Prisma migrations
# are roll-forward; the pre-migration backup made by deploy-staging.sh is the
# manual recovery path for schema damage.
#
# Exit codes: 0 rolled back and healthy · 1 no usable rollback target ·
# 4 rollback applied but health check still failing
# =============================================================================
set -Eeuo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-docker-compose.staging.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-.env.staging}"
IMAGES_ENV_FILE="${IMAGES_ENV_FILE:-.env.images}"
STATE_FILE="${STATE_FILE:-.beleqet-last-successful-sha}"
HEALTH_MAX_ATTEMPTS="${HEALTH_MAX_ATTEMPTS:-20}"
HEALTH_RETRY_DELAY="${HEALTH_RETRY_DELAY:-5}"

FAILING_SHA="${1:-}"

log() { printf '[rollback] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

compose() {
  docker compose --env-file "$ENV_FILE_PATH" --env-file "$IMAGES_ENV_FILE" \
    -f "$COMPOSE_FILE_PATH" "$@"
}

# ── Collect status before touching anything ──────────────────────────────────
compose ps 2>/dev/null || true

# ── Select and validate the rollback target ──────────────────────────────────
if [ ! -f "$STATE_FILE" ]; then
  log "no previous successful deployment recorded — container rollback impossible"
  exit 1
fi
PREVIOUS_SHA="$(tr -d '[:space:]' <"$STATE_FILE")"

case "$PREVIOUS_SHA" in
  *[!0-9a-f]* | '')
    log "recorded state is not a valid commit SHA — refusing rollback"
    exit 1
    ;;
esac
if [ "${#PREVIOUS_SHA}" -ne 40 ]; then
  log "recorded state is not a full 40-character SHA — refusing rollback"
  exit 1
fi
if [ "$PREVIOUS_SHA" = "$FAILING_SHA" ]; then
  log "recorded SHA equals the failing SHA — rollback would change nothing"
  exit 1
fi

# shellcheck disable=SC1090
set -a && . "$ENV_FILE_PATH" && set +a
: "${IMAGE_NAMESPACE:?IMAGE_NAMESPACE must be set in ${ENV_FILE_PATH}}"
: "${HEALTH_URL_BACKEND:?HEALTH_URL_BACKEND must be set in ${ENV_FILE_PATH}}"

# ── Restore previous image references and restart ────────────────────────────
log "rolling containers back to $PREVIOUS_SHA"
{
  printf 'BACKEND_IMAGE=%s/beleqet-backend:%s\n' "$IMAGE_NAMESPACE" "$PREVIOUS_SHA"
  printf 'ADMIN_IMAGE=%s/beleqet-admin-frontend:%s\n' "$IMAGE_NAMESPACE" "$PREVIOUS_SHA"
  printf 'JOBS_IMAGE=%s/beleqet-jobs-frontend:%s\n' "$IMAGE_NAMESPACE" "$PREVIOUS_SHA"
} >"$IMAGES_ENV_FILE"

compose up -d --remove-orphans

# ── Verify the rolled-back release ───────────────────────────────────────────
if "$SCRIPT_DIR/health-check.sh" "$HEALTH_URL_BACKEND" "$HEALTH_MAX_ATTEMPTS" "$HEALTH_RETRY_DELAY"; then
  log "rollback to $PREVIOUS_SHA is healthy"
  exit 0
fi
log "rollback applied but backend is still unhealthy — manual intervention required"
exit 4
