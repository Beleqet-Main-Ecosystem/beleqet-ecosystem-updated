#!/usr/bin/env bash
# =============================================================================
# VPS Update Script — Chapa keys + frontend-main rebuild
# Run this ON THE VPS: bash scripts/vps-update-chapa-rebuild.sh
# =============================================================================
set -euo pipefail

DEPLOY_PATH="/srv/beleqet-staging"
ENV_FILE="$DEPLOY_PATH/.env.staging"

echo "==> [1/4] Appending Chapa credentials to $ENV_FILE ..."

# Remove any existing (placeholder) Chapa lines first
sed -i '/^CHAPA_SECRET_KEY=/d;/^CHAPA_PUBLIC_KEY=/d;/^CHAPA_ENCRYPTION_KEY=/d' "$ENV_FILE"

# Append live Chapa keys
cat >> "$ENV_FILE" <<'CHAPA'

# Chapa Credentials (added 2026-08-24)
CHAPA_SECRET_KEY=CHASECK_TEST-KLcMVodePyl8ZfXZBriSccBhDvRaN3F9
CHAPA_PUBLIC_KEY=CHAPUBK_TEST-GC7FFJNuSJmjMc8oc2JE5qn3z0e8QJMj
CHAPA_ENCRYPTION_KEY=uDUKgQJuj2IsZz4rEx1jbeIH
CHAPA

echo "==> [2/4] Pulling latest code from main ..."
cd "$DEPLOY_PATH"
git pull origin main

echo "==> [3/4] Rebuilding homepage-frontend (frontend-main) container ..."
docker compose build --no-cache homepage-frontend

echo "==> [4/4] Restarting homepage-frontend container ..."
docker compose up -d --force-recreate homepage-frontend

echo ""
echo "Done. Verifying container is up ..."
sleep 3
docker ps --filter "name=beleqet2-homepage" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo "Test: curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:3002"
curl -s -o /dev/null -w "HTTP status: %{http_code}\n" http://127.0.0.1:3002 || echo "Container not yet ready — wait a few seconds and retry"
