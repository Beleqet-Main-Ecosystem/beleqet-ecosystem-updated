#!/usr/bin/env bash
# =============================================================================
# create-test-env.sh — write the synthetic .env used by CI test jobs
#
# Usage: create-test-env.sh [output-path]   (default: .env)
#
# Every value is synthetic; nothing here is a real credential. Centralised so
# the CI workflow, the local baseline, and the integration tests all generate
# the identical test environment instead of three drifting copies.
# =============================================================================
set -Eeuo pipefail

OUT="${1:-.env}"

cat >"$OUT" <<'EOF'
NODE_ENV=test
PORT=4000
FRONTEND_URL=http://localhost:3000
APP_BASE_URL=http://localhost:4000
DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/beleqet_test
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
JWT_ACCESS_SECRET=ci_test_jwt_secret_64_chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
JWT_ACCESS_EXPIRES=15m
JWT_REFRESH_EXPIRES=30d
SESSION_SECRET=ci_session_secret_synthetic_value
TOTP_ENCRYPTION_KEY=abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789
TOTP_TEMP_SECRET=ci_test_totp_secret_64_chars_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TOTP_ISSUER=Beleqet
OAUTH_TOKEN_ENCRYPTION_KEY=VGVzdEVuY3J5cHRpb25LZXkzMkJ5dGVzTG9uZ1hZWjE=
GOOGLE_CLIENT_ID=synthetic_google_client_id
GOOGLE_CLIENT_SECRET=synthetic_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:4000/api/v1/auth/google/callback
LINKEDIN_CLIENT_ID=synthetic_linkedin_client_id
LINKEDIN_CLIENT_SECRET=synthetic_linkedin_client_secret
LINKEDIN_CALLBACK_URL=http://localhost:4000/api/v1/auth/linkedin/callback
OPENAI_API_KEY=sk-test-synthetic-key-for-ci
OPENAI_MODEL=gpt-4o-mini
GROQ_API_KEY=synthetic_groq_key
GROQ_MODEL=llama-3.1-8b-instant
STRIPE_SECRET_KEY=sk_test_synthetic
STRIPE_WEBHOOK_SECRET=whsec_synthetic
PAYPAL_CLIENT_ID=synthetic_paypal_client_id
PAYPAL_CLIENT_SECRET=synthetic_paypal_client_secret
CHAPA_SECRET_KEY=
SMTP_HOST=localhost
SMTP_PORT=2525
SMTP_USER=synthetic_smtp_user
SMTP_PASSWORD=synthetic_smtp_password
SMTP_SECURE=false
SMTP_FROM_ADDRESS=noreply@example.test
BULL_BOARD_USERNAME=admin
BULL_BOARD_PASSWORD=ci_board_password_synthetic
SWAGGER_ENABLED=false
EOF

printf 'synthetic test environment written to %s\n' "$OUT"
