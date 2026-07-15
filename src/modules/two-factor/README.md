# Two-Factor Authentication (TOTP 2FA) Module

## Overview

This module implements Time-based One-Time Password (TOTP) two-factor authentication per RFC 6238 for the Beleqet platform. It provides:

- TOTP enrollment with authenticator app (Google Authenticator, Authy, etc.)
- Login flow with 2FA challenge
- Step-up authentication for sensitive actions (wallet withdrawals, milestone releases)
- Action-scoped step-up challenge tokens for fine-grained authorization
- Backup codes (10 single-use codes for account recovery, 50-bit entropy each)
- Redis-backed replay attack prevention (SETNX with 90s TTL)
- Rate limiting on verification endpoints
- Audit logging of all 2FA attempts

## Required Environment Variables

```env
# 64 hex characters (32 bytes for AES-256). Generate with: openssl rand -hex 32
TOTP_ENCRYPTION_KEY=<64 hex chars>

# Display name shown in authenticator app. Defaults to "Beleqet"
TOTP_ISSUER=Beleqet

# Separate signing key for 2FA temp/challenge tokens (REQUIRED — must differ from JWT_ACCESS_SECRET)
# Generate with: openssl rand -hex 64
TOTP_TEMP_SECRET=<64+ hex chars>

# Redis connection — used for replay attack prevention (SETNX), rate limiting counters,
# and session state across multiple server instances
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_TLS=false
```

## Architecture

### Enrollment Flow

```
Client                           Server
  │                                │
  │  POST /auth/2fa/enroll         │
  │  ──────────────────────────►   │ generate TOTP secret
  │                                │ store: secret (encrypted), enabled=false
  │                                │       enrollmentToken (signed JWT, 10min TTL)
  │  { provisioningUri,            │
  │    enrollmentToken,            │
  │    secret }                    │
  │  ◄──────────────────────────   │
  │                                │
  │ (user scans QR / enters key)   │
  │                                │
  │ POST /auth/2fa/confirm         │
  │ { enrollmentToken, code }      │
  │ ──────────────────────────►   │ verify enrollmentToken (purpose=2fa_enrollment)
  │                                │ verify code via otplib
  │                                │ check replay via Redis SETNX
  │                                │ if valid: set enabled=true
  │                                │ generate 10 backup codes (hashed)
  │  { success, backupCodes[] }    │
  │  ◄──────────────────────────   │
```

### Login Flow with 2FA

```
POST /auth/login { email, password }
  │
  ├─ validateUser(email, password)
  │
  ├─ check UserTwoFactor.enabled
  │    ├─ false → issueTokens(user)        // original flow
  │    └─ true  → return {
  │                  requires2fa: true,
  │                  tempToken: <5min JWT, purpose=2fa_login>,
  │                  factorId: <obfuscated>
  │                }
  │
  POST /auth/2fa/verify { tempToken, code }
  │    → verifies tempToken (purpose=2fa_login) + OTP + replay check
  │    → returns issueTokens(user)
```

### Step-Up Flow (Sensitive Actions)

```
POST /wallet/withdraw (or milestone release)
  │
  ├─ JwtAuthGuard (authenticated)
  ├─ StepUpGuard checks for valid step-up token (purpose=2fa_step_up)
  │    └─ if missing/expired → 401 with:
  │         { requiresStepUp: true, stepUpToken: <5min challenge> }
  │
  POST /auth/2fa/step-up { stepUpToken, code }
  │    → verifies challenge token (purpose=2fa_step_up_challenge) + OTP
  │    → checks action/resourceId scoping if present in challenge
  │    → checks replay via Redis SETNX
  │    → returns { stepUpToken: <15min verified token> }
  │
  Client retries original request with new step-up token
```

### Action-Scoped Challenges (Optional)

For tighter security, clients can request a challenge token scoped to a specific action
and resource before performing a sensitive operation:

```
POST /auth/2fa/challenge { action: "wallet_withdraw", resourceId: "wallet-123" }
  → returns { stepUpToken: <5min JWT scoped to wallet_withdraw> }

POST /auth/2fa/step-up { stepUpToken, code, action: "wallet_withdraw" }
  → verifies action matches challenge token's scope
  → returns step-up result token
```

This prevents a step-up challenge obtained for one action from being used to authorize
a different action.

## API Endpoints

| Method | Endpoint | Auth | Rate Limit | Purpose |
|--------|----------|------|------------|---------|
| POST | `/auth/2fa/enroll` | JWT | — | Start 2FA enrollment |
| POST | `/auth/2fa/confirm` | JWT | — | Confirm enrollment with OTP |
| POST | `/auth/2fa/verify` | — | 5/15min | Complete login with OTP |
| POST | `/auth/2fa/challenge` | JWT | — | Request action-scoped step-up challenge |
| POST | `/auth/2fa/step-up` | — | 5/15min | Step-up verification |
| POST | `/auth/2fa/backup-code` | — | 5/15min | Use backup code for login |
| POST | `/auth/2fa/backup-codes/regenerate` | JWT | — | Regenerate backup codes (requires step-up) |
| POST | `/auth/2fa/disable` | JWT | — | Disable 2FA |

## Token Purpose Reference

| Purpose | Endpoint(s) | Issued By | Description |
|---------|-------------|-----------|-------------|
| `2fa_login` | `/verify`, `/backup-code` | AuthService.login() | Temp token for 2FA login flow |
| `2fa_enrollment` | `/confirm` | startEnrollment() | Temp token for enrollment confirmation |
| `2fa_step_up_challenge` | `/step-up`, `/backup-codes/regenerate` | StepUpGuard, `/challenge` | Challenge token for step-up flow |
| `2fa_step_up` | (used as Bearer token) | verifyStepUp() | Verified step-up result token passed to sensitive actions |

## Sensitive Actions (Step-Up Protected)

- `POST /wallet/withdraw` — Freelancer wallet withdrawal
- `POST /escrow/milestones/:id/release` — Milestone fund release

## Security Design

- **TOTP secrets**: Encrypted at rest with AES-256-GCM. Each record has a unique random IV. Never logged, never returned in API responses.
- **Backup codes**: 10 codes × 10 chars sampled from unambiguous alphabet (A-HJKMNP-Z2-9, 32 chars) = 50 bits entropy each. Hashed with bcrypt (salt rounds 10). Single-use only.
- **Replay prevention**: Redis `SETNX` with 90-second TTL. Key format: `2fa:used:{userId}:{timeStep}:{code}`. Works across multiple server instances.
- **Rate limiting**: 5 verification attempts per 15 minutes on all verify/step-up/backup-code endpoints.
- **Audit trail**: All failed 2FA attempts logged to `events_log` table with event types: `2FA_VERIFY_FAILURE`, `2FA_STEPUP_FAILURE`, `2FA_BACKUP_FAILURE`, `2FA_ENROLL_FAILURE`.
- **Action scoping**: Step-up challenge tokens can be scoped to specific actions and resources via the `/challenge` endpoint. The `/step-up` endpoint verifies the scope matches the request.
- **GDPR**: Secrets excluded from data export (boolean only); cascade delete on account erasure.
- **Separate signing key**: `TOTP_TEMP_SECRET` is required and must differ from `JWT_ACCESS_SECRET` to limit blast radius if the JWT signing key is compromised.

## Replay Attack Prevention (Redis-based)

Replay attacks are prevented using Redis `SET` with `NX` (set if not exists) and a 90-second TTL:

```
2fa:used:{userId}:{code} → 1 (TTL: 90s)
```

- The key binds the code to the user without a timeStep, so a code accepted within otplib's drift window cannot be replayed in a subsequent window
- 90-second TTL safely covers clock drift
- Works correctly across multiple server instances
- No manual cleanup needed (TTL handles expiry)

## Backup Code Entropy

Each backup code is 10 characters sampled uniformly from an unambiguous alphabet:

```
ABCDEFGHJKMNPQRSTUVWXYZ23456789
```

- 32 characters (5 bits per character)
- Excludes visually ambiguous: O/0, I/1, L
- Total entropy: 10 × log2(32) = **50 bits per code**
- Generation is via `crypto.randomBytes()` with uniform modulo (256 % 32 = 0, no bias)

## Local Testing

1. Set `TOTP_ENCRYPTION_KEY`, `TOTP_TEMP_SECRET` in `.env`
2. Ensure Redis is running (or start via `docker compose up -d redis`)
3. Run Prisma migration: `npx prisma migrate dev`
4. Run tests: `npx jest --coverage src/modules/two-factor`

## Dependencies

- `otplib` v13+ — TOTP generation and verification (RFC 6238)
- `qrcode` — QR code generation for provisioning URI
- `@nestjs/jwt` — JWT signing for temp tokens and step-up tokens
- `@nestjs/throttler` — Rate limiting
- `ioredis` — Redis client for replay attack prevention
- `@nestjs/bull` + `bull` — Background cleanup of expired enrollments
