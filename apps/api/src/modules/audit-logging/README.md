# Audit Logging Module

Automated Testing & Audit Logging for the Beleqet Admin & Control surface.

## Features

- **HTTP audit interceptor** — persists `HTTP_REQUEST` events after each request (skips health, swagger, and audit-log routes).
- **GDPR redaction** — strips passwords, tokens, emails, and phone numbers before write.
- **Admin REST API** — list, filter, search, detail, and JSON/CSV export.
- **i18n** — `en` / `am` messages under `audit-logging.*`.
- **Multi-currency** — when payloads include `amount` + `currency`, responses attach `amountInDisplayCurrency`.
- **Jest coverage** — unit specs for service / interceptor / redactor plus an integration suite.

## Endpoints (ADMIN)

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/admin/audit-logs` | Filtered, paginated list |
| `GET` | `/api/v1/admin/audit-logs/export` | Download JSON or CSV (`format=json\|csv`) |
| `GET` | `/api/v1/admin/audit-logs/:id` | Single log |

### Query parameters

`eventType`, `entityId`, `entityType`, `actorUserId`, `httpMethod`, `path`, `statusCode`, `from`, `to`, `search`, `page`, `limit`, `lang`, `currency`, `format`.

## Database

Extends Prisma `EventLog` (`events_log`) with optional HTTP/actor columns. Apply:

```bash
npx prisma migrate deploy
```

## Admin UI

`frontend` → **Admin → Audit Logs** (`/admin/logs`).

## GDPR

- Payloads are redacted on write.
- `GET /api/v1/admin/compliance/gdpr/export/:userId` includes related audit rows (`entityId` or `actorUserId`).

## Tests

```bash
npm test -- --testPathPattern=audit-logging
npm test -- --config ./package.json --testPathPattern=audit-logging.integration
```

CI already runs unit specs and `*.integration.spec.ts` separately.
