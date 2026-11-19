#!/usr/bin/env bash
# =============================================================================
# verify-compose.sh — render every Compose file with synthetic values
#
# Fails when either Compose file is invalid, or when docker-compose.ci.yml
# renders despite a missing required variable (its ${VAR:?} guards).
# =============================================================================
set -Eeuo pipefail

log() { printf '[verify-compose] %s\n' "$*"; }

command -v docker >/dev/null 2>&1 || {
  log "ERROR: docker is required"
  exit 1
}

workdir="$(mktemp -d)"
trap 'rm -rf "$workdir"' EXIT

# ── Production compose: its settings come from the server's .env ─────────────
log "rendering docker-compose.yml"
docker compose -f docker-compose.yml config >/dev/null

# ── CI compose: must render with a complete synthetic environment ────────────
ci_env="$workdir/env.ci"
cat >"$ci_env" <<'EOF'
CI_DB_USER=synthetic_user
CI_DB_PASSWORD=synthetic_password
CI_DB_NAME=synthetic_db
CI_FRONTEND_URLS=http://localhost:3000,http://localhost:3001
CI_APP_BASE_URL=http://localhost:4000
JWT_ACCESS_SECRET=synthetic_jwt_secret
SESSION_SECRET=synthetic_session_secret
TOTP_ENCRYPTION_KEY=synthetic_totp_key
TOTP_TEMP_SECRET=synthetic_totp_temp
GDPR_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
E2EE_SERVER_KEY=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
ENCRYPTION_KEY=1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef
OAUTH_TOKEN_ENCRYPTION_KEY=VGVzdEVuY3J5cHRpb25LZXkzMkJ5dGVzTG9uZ1hZWjE=
GOOGLE_CLIENT_ID=synthetic_google_client_id
GOOGLE_CLIENT_SECRET=synthetic_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
LINKEDIN_CLIENT_ID=synthetic_linkedin_client_id
LINKEDIN_CLIENT_SECRET=synthetic_linkedin_client_secret
LINKEDIN_CALLBACK_URL=http://localhost:4000/api/v1/auth/linkedin/callback
SMTP_HOST=localhost
SMTP_USER=synthetic_smtp_user
SMTP_PASSWORD=synthetic_smtp_password
SMTP_FROM_ADDRESS=noreply@example.test
STRIPE_SECRET_KEY=sk_test_synthetic
STRIPE_WEBHOOK_SECRET=whsec_synthetic
PAYPAL_CLIENT_ID=synthetic_paypal_client_id
PAYPAL_CLIENT_SECRET=synthetic_paypal_client_secret
UNSUBSCRIBE_SECRET=synthetic_unsubscribe_secret_64chars_minimum_for_production_use
EOF
images_env="$workdir/env.images"
cat >"$images_env" <<'EOF'
BACKEND_IMAGE=ghcr.io/example/beleqet-backend:0000000000000000000000000000000000000000
ADMIN_IMAGE=ghcr.io/example/beleqet-admin-frontend:0000000000000000000000000000000000000000
JOBS_IMAGE=ghcr.io/example/beleqet-jobs-frontend:0000000000000000000000000000000000000000
EOF

log "rendering docker-compose.ci.yml with full synthetic env"
docker compose --env-file "$ci_env" --env-file "$images_env" \
  -f docker-compose.ci.yml config >/dev/null

# ── CI compose: must REFUSE to render without required variables ─────────────
log "verifying the CI compose rejects a missing required variable"
if docker compose --env-file "$images_env" \
  -f docker-compose.ci.yml config >/dev/null 2>&1; then
  log "ERROR: the CI compose rendered without its required variables"
  exit 1
fi

log "all compose files verified"
