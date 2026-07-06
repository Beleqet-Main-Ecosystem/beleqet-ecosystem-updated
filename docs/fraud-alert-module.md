# Fraud Alert Module — The Brain & Logic Module

Identity and mitigate suspicious platform activity in real time: off-platform payments, fake profiles, payment anomalies, and duplicate listings.

---

## Architecture

```
src/modules/fraud-alert/
 ├─ fraud-alert.module.ts            NestJS module definition
 ├─ fraud-alert.service.ts           Core detection engine (4 pluggable detectors)
 ├─ fraud-alert.processor.ts         Bull queue consumer (async scanning)
 ├─ fraud-alert.controller.ts        REST endpoints for scan triggers
 ├─ fraud-alert.service.spec.ts      17 unit tests
 ├─ fraud-alert.processor.spec.ts    5 processor tests
 ├─ fraud-alert.controller.spec.ts   5 controller tests
 └─ dto/
      ├─ query-fraud-alerts.dto.ts   Alert list query DTO
      ├─ resolve-fraud-alert.dto.ts  Resolution DTO
      └─ create-fraud-rule.dto.ts    Rule CRUD DTOs

prisma/schema.prisma                New enums + FraudRule + FraudAlert models
                                     FraudAlert.legalBasis, expiryAt, deletedAt, anonymizedAt
src/i18n/en/messages.json           English fraud strings (24 keys under fraud.*)
src/i18n/am/messages.json           Amharic fraud strings (24 keys under fraud.*)
src/modules/queues/queues.constants.ts   FRAUD queue + FRAUD_JOBS
src/modules/admin/admin.controller.ts    11 fraud alert management routes
src/modules/admin/admin.module.ts        Imports FraudAlertModule + ChatModule + QueuesModule
src/app.module.ts                   FraudAlertModule registration
src/main.ts                         Swagger tag

web/                                Next.js admin dashboard
 ├─ src/app/admin/fraud/page.tsx    Alert list (filters, pagination)
 ├─ src/app/admin/fraud/[id]/page.tsx  Alert detail + resolve form
 ├─ src/app/admin/fraud/rules/page.tsx Rule management
 ├─ src/lib/api.ts                  Typed API client
 ├─ src/types/fraud.ts              Shared TypeScript interfaces
 └─ __tests__/ResolveForm.test.tsx  Frontend component test
```

---

## Detection Rules

### 1. Off-Platform Payment (`OFF_PLATFORM_PAYMENT`)

Scans chat message content for payment-related indicators in English and Amharic:

| Category | Pattern Examples |
|---|---|
| Phone numbers | `0911345678`, `+251911234567` |
| Email addresses | `user@domain.com` |
| IBAN / bank details | `ET4512345678901234567890` |
| Crypto addresses | `0x...`, `bc1...` |
| Payment apps | PayPal, Western Union, Telebirr, CBE Birr, Amole, M-Pesa |
| Amharic phrases | `በቀጥታ ክፈሉ`, `ወደ ቴሌግራም ላክ`, `ቴሌብር`, `ሲቢ ኢ ብር` |

Each match contributes a weight; total score is capped at 100.

### 2. Fake Profile (`FAKE_PROFILE`)

Signals checked:
- `emailVerified = false` → +15
- `skillVerified = false` → +10
- 8+ unverified skills + unverified email → +30
- 15+ unverified skills → +25
- No verified company → +10
- Low `CandidateScore` with many skill claims → +20

### 3. Payment Anomaly (`PAYMENT_ANOMALY`)

Analyses wallet/escrow transactions:
- 24h transaction velocity >20 → +30
- Repeated round-number amounts (divisible by 1000) → +20
- Refund loops (excessive DEBIT_FEE in 24h) → +25
- Multiple gateway failures → +20

### 4. Duplicate Listing (`DUPLICATE_LISTING`)

Bigram text similarity on job descriptions:
- Similarity >0.95 → +50 per match
- Similarity >0.80 → +35 per match
- Same company, within 30-day window

---

## Alert Lifecycle

```
[Entity action]  -->  Detector evaluates  -->  Score exceeds threshold?
                                                       │
                          ┌────────────────────────────┘
                          ▼
                   FraudAlert created (status: OPEN)
                          │
                   EventLog written
                          │
              IN_APP notification → all ADMINS
                          │
                  eventEmitter.emit('fraud.alert.created')
                          │
         ┌────────────────┼────────────────────┐
         ▼                ▼                    ▼
     RESOLVED      FALSE_POSITIVE         CONFIRMED
    (no action)   (no action)          (admin may ban user)
```

---

## API Endpoints

All routes authenticated with `JWT` and guarded by `Roles('ADMIN')`. Base prefix: `/api/v1`

### Scan Triggers (enqueue Bull jobs)

| Method | Path | Description |
|---|---|---|
| POST | `/fraud-alert/scan/user/:userId` | Scan a user for fake profile signals |
| POST | `/fraud-alert/scan/message/:messageId` | Scan a chat message for off-platform payment |
| POST | `/fraud-alert/scan/transaction/:userId` | Scan wallet transactions for anomalies |
| POST | `/fraud-alert/scan/job/:jobId` | Scan a job for duplicate listings |
| POST | `/fraud-alert/scan/all` | Batch scan all active non-admin users |

### Alert Management

| Method | Path | Description |
|---|---|---|
| GET | `/admin/fraud/alerts` | Paginated list. Query: `?status=OPEN&severity=HIGH&ruleType=OFF_PLATFORM_PAYMENT&page=1&limit=20` |
| GET | `/admin/fraud/alerts/:id` | Alert detail with evidence and related context (message/chatRoom/user/job) |
| PATCH | `/admin/fraud/alerts/:id` | Resolve. Body: `{ "status": "RESOLVED", "resolutionNote": "..." }` |

### Rule Management

| Method | Path | Description |
|---|---|---|
| GET | `/admin/fraud/rules` | List all fraud detection rules |
| POST | `/admin/fraud/rules` | Create a rule. Body: `{ "name", "ruleType", "i18nKey", "severity?", "enabled?", "config?" }` |
| PATCH | `/admin/fraud/rules/:id` | Update a rule. Body: `{ "enabled": false }` |

### GDPR Compliance

| Method | Path | Description |
|---|---|---|
| GET | `/admin/fraud/alerts/gdpr/export/:userId` | Export all fraud alerts (PII-redacted) + audit log |
| DELETE | `/admin/fraud/alerts/gdpr/delete/:userId` | Soft-delete alerts (right to erasure) + audit log |
| GET | `/admin/compliance/gdpr/export/:userId` | Full user export (now includes `fraudAlerts` + audit log) |

---

## How to Run

### 1. Install dependencies

```bash
npm install
```

### 2. Set up the database

```bash
# Generate Prisma client from schema
npx prisma generate

# Apply migration (creates fraud_alerts + fraud_rules tables)
npx prisma migrate dev --name fraud_alert

# Seed default fraud rules + demo data
npm run prisma:seed
```

### 3. Start the backend

```bash
npm run start:dev
```

The API starts on `http://localhost:4000`. Swagger UI is at `http://localhost:4000/api/docs` (look for the **fraud-alert** and **admin** tag sections).

### 4. Run tests

```bash
npm test
```

All 36 tests pass (fraud-alert + existing modules).

### 5. Start the frontend dashboard (optional)

```bash
cd web
npm install
npm run dev
```

Dashboard on `http://localhost:4001/admin/fraud`. Sign in at `http://localhost:4001/login`.

#### Dev admin credentials

Set in `.env` (`ADMIN_EMAIL` / `ADMIN_PASSWORD`). The backend upserts this account on every start:

| Field | Value |
|-------|-------|
| Email | `admin@beleqet.local` |
| Password | `adminpassword12` |

Change these in `.env` before production — never commit real credentials.

### Prerequisites

- Node.js ≥18
- PostgreSQL database with connection string in `.env` (`DATABASE_URL`)
- Redis instance (for Bull queues) — configured via `REDIS_HOST`/`REDIS_PORT` in `.env`

---

## Internationalization (i18n)

The fraud module injects `I18nService` from `nestjs-i18n` and resolves all user-facing strings through translation keys. Language is auto-detected via `Accept-Language` header, query param `?lang=`, or `x-custom-lang` header.

**Key structure** under `fraud.*`:

| Namespace | Keys | Used in |
|---|---|---|
| `fraud.alert.title.*` | One per rule type | Notification title |
| `fraud.alert.body.*` | One per rule type | Notification body |
| `fraud.severity.*` | LOW / MEDIUM / HIGH / CRITICAL | Dashboard labels |
| `fraud.status.*` | OPEN / UNDER_REVIEW / RESOLVED / FALSE_POSITIVE / CONFIRMED | Dashboard labels |
| `fraud.notification.*` | user_resolved / user_false_positive / user_confirmed / prefix | User notification on resolution |
| `fraud.controller.*` | scan_queued_user / scan_queued_message / etc. | Scan trigger responses |
| `fraud.gdpr.*` | export_label / delete_label / retention_notice / export_audit / delete_audit | GDPR endpoints |
| `fraud.admin.*` | resolved / false_positive / confirmed | Admin resolution messages |
| `fraud.rule.*` | enabled / disabled / threshold_exceeded | Rule management |
| `fraud.email.*` | subject / body | Email notification templates |

**Supported languages:**

| Language | File |
|---|---|
| English (en) | `src/i18n/en/messages.json` |
| Amharic (am) | `src/i18n/am/messages.json` |

To add a new language, create `src/i18n/<lang>/messages.json` with the same key structure. No code changes needed.

---

## Multi-Currency

**Per-transaction currency storage** — `FraudAlert.currency` records the ISO 4217 code for every alert.

**Currency-aware anomaly detection** — `detectPaymentAnomaly()` normalises amounts using a static exchange-rate factor table (`CURRENCY_FACTORS`):

| Currency | Factor (vs ETB) |
|---|---|
| ETB | 1 |
| USD | 125 |
| EUR | 135 |
| GBP | 160 |
| KES | 0.8 |
| AED | 34 |

Round-amount thresholds (`% 1000` in raw form) are scaled by the factor, so a `$100` transaction (10,000 USD cents × 125 = 1,250,000) is detected as a round amount on an ETB-equivalent basis. Velocity checks remain currency-agnostic (count-based rather than value-based).

**Default fallback** — `ETB` when no currency is specified. Alert `evidence` records the currency for traceability.

---

## GDPR Notes

### Data Minimisation
- **PII redaction in evidence** — `redactPii()` strips phone numbers, emails, IBANs, and crypto addresses before alert storage. Evidence payloads carry `redacted: true`.
- **sanitizeEvidence()** — recursively redacts all string fields in evidence before `FraudAlert.evidence` is written.

### Data Retention
- Every `FraudAlert` is created with `legalBasis = 'legitimate_interest'` and an automatic `expiryAt` (default: +90 days from creation).
- The `FraudAlert.expiryAt` field is indexed — a scheduled cleanup job can query `WHERE expiryAt < now() AND deletedAt IS NULL` to batch-anonymise or delete.
- `FraudAlert.deletedAt` / `FraudAlert.anonymizedAt` fields enable soft-deletion and anonymisation tracking.

### Right of Access (Article 15)
- `GET /admin/compliance/gdpr/export/:userId` — exports all user data including `fraudAlerts`; writes an audit `EventLog`.
- `GET /admin/fraud/alerts/gdpr/export/:userId` — exports only fraud alerts with already-redacted PII; writes an audit `EventLog`.

### Right to Erasure (Article 17)
- `DELETE /admin/fraud/alerts/gdpr/delete/:userId` — soft-deletes all fraud alerts by setting `deletedAt`; writes an audit `EventLog` with the count.

### Accountability
- All GDPR-sensitive operations (`export`, `delete`, alert creation/resolution) write an `EventLog` row with `processedBy: FraudAlertService.name`, `eventType`, `entityId`, and a timestamped payload. This provides a full audit trail for compliance reviews.
