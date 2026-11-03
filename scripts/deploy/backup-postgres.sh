#!/usr/bin/env bash
# =============================================================================
# Automated PostgreSQL Backup Script for Beleqet Ecosystem
# Target VPS: 178.105.7.221
# Deployment path: /srv/beleqet-staging
#
# Retention: 14 days of local daily compressed dumps
# Optional: Telegram alert upon backup failure
# =============================================================================
set -euo pipefail

DEPLOY_PATH="/srv/beleqet-staging"
BACKUP_DIR="/var/backups/beleqet/postgres"
ENV_FILE="$DEPLOY_PATH/.env.staging"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/beleqet_db_${TIMESTAMP}.sql.gz"
RETENTION_DAYS=14

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"

# Source DB environment variables from staging env
if [ ! -f "$ENV_FILE" ]; then
    echo "ERROR: Environment file $ENV_FILE not found!" >&2
    exit 1
fi

DB_USER=$(grep -E '^STAGING_DB_USER=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
DB_NAME=$(grep -E '^STAGING_DB_NAME=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'")
TELEGRAM_BOT_TOKEN=$(grep -E '^TELEGRAM_BOT_TOKEN=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)
TELEGRAM_CHANNEL_ID=$(grep -E '^TELEGRAM_CHANNEL_ID=' "$ENV_FILE" | cut -d '=' -f2- | tr -d '"' | tr -d "'" || true)

DB_USER=${DB_USER:-beleqet_staging}
DB_NAME=${DB_NAME:-beleqet_staging}

# Determine DB container name
CONTAINER_NAME=$(docker ps --filter "name=db" --format "{{.Names}}" | grep -E 'db|postgres' | head -n 1)

if [ -z "$CONTAINER_NAME" ]; then
    echo "ERROR: PostgreSQL container not found running!" >&2
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHANNEL_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHANNEL_ID}" \
            -d "text=🚨 [VPS 178.105.7.221] DB Backup FAILED: PostgreSQL container is not running!" > /dev/null || true
    fi
    exit 1
fi

echo "[$(date +'%Y-%m-%d %H:%M:%S')] Starting backup of database '$DB_NAME' from container '$CONTAINER_NAME'..."

# Perform pg_dump inside container and compress on host
if docker exec "$CONTAINER_NAME" pg_dump -U "$DB_USER" "$DB_NAME" | gzip > "$BACKUP_FILE"; then
    BACKUP_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Backup successfully created: $BACKUP_FILE ($BACKUP_SIZE)"
    
    # Prune backups older than retention window
    find "$BACKUP_DIR" -name "beleqet_db_*.sql.gz" -type f -mtime +"$RETENTION_DAYS" -delete
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] Old backups older than $RETENTION_DAYS days pruned."
else
    echo "ERROR: pg_dump command failed!" >&2
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHANNEL_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHANNEL_ID}" \
            -d "text=🚨 [VPS 178.105.7.221] DB Backup FAILED during pg_dump execution!" > /dev/null || true
    fi
    exit 1
fi
