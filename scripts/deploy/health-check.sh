#!/usr/bin/env bash
# =============================================================================
# health-check.sh — bounded HTTP readiness probe
#
# Usage: health-check.sh <url> [max_attempts] [delay_seconds]
#
# Exits 0 on the first HTTP 2xx response, 1 after max_attempts failures.
# Prints only the URL host/path and status codes — never response bodies,
# never credentials. Mirrors the retry semantics of tools/ci/health-check.ts.
# =============================================================================
set -Eeuo pipefail

URL="${1:-}"
MAX_ATTEMPTS="${2:-20}"
DELAY_SECONDS="${3:-5}"

log() { printf '[health] %s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

case "$URL" in
  http://* | https://*) ;;
  *)
    log "ERROR: URL must start with http:// or https://"
    exit 1
    ;;
esac
case "$MAX_ATTEMPTS" in
  *[!0-9]* | '' | 0)
    log "ERROR: max_attempts must be a positive integer"
    exit 1
    ;;
esac

command -v curl >/dev/null 2>&1 || {
  log "ERROR: curl is required"
  exit 1
}

attempt=1
while [ "$attempt" -le "$MAX_ATTEMPTS" ]; do
  status="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "$URL" 2>/dev/null || echo 000)"
  case "$status" in
    2??)
      log "healthy (HTTP $status) on attempt $attempt: $URL"
      exit 0
      ;;
    *)
      log "attempt $attempt/$MAX_ATTEMPTS: HTTP $status for $URL"
      ;;
  esac
  attempt=$((attempt + 1))
  [ "$attempt" -le "$MAX_ATTEMPTS" ] && sleep "$DELAY_SECONDS"
done

log "UNHEALTHY after $MAX_ATTEMPTS attempts: $URL"
exit 1
