#!/usr/bin/env bash
# =============================================================================
# migrate.sh — apply Prisma migrations exactly once against the staging DB
#
# Runs `prisma migrate deploy` in a one-off backend container (the image
# already contains the schema, migration files, and the prisma CLI). Never
# uses `prisma db push`. A non-zero exit here means the migration failed and
# the caller must NOT promote the new release.
#
# Environment: COMPOSE_FILE_PATH / ENV_FILE_PATH / IMAGES_ENV_FILE — same
# defaults as deploy-staging.sh so both scripts render the identical stack.
# =============================================================================
set -Eeuo pipefail

COMPOSE_FILE_PATH="${COMPOSE_FILE_PATH:-docker-compose.staging.yml}"
ENV_FILE_PATH="${ENV_FILE_PATH:-.env.staging}"
IMAGES_ENV_FILE="${IMAGES_ENV_FILE:-.env.images}"

log() { printf '[migrate] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

log "applying Prisma migrations (prisma migrate deploy)"
if docker compose --env-file "$ENV_FILE_PATH" --env-file "$IMAGES_ENV_FILE" \
  -f "$COMPOSE_FILE_PATH" run --rm --no-deps backend \
  npx prisma migrate deploy; then
  log "migrations applied successfully"
else
  log "ERROR: prisma migrate deploy failed"
  exit 3
fi
