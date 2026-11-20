# Audit

The platform's audit trail: the `events_log` table, append-only (database triggers refuse UPDATE,
DELETE and TRUNCATE). It records **business events**, not web requests; nginx keeps the request logs.

`AuditModule` is global, like a logger: any module can inject `AuditService`, or the `AUDIT_LOGGER`
interface (`common/interfaces/audit-logger.interface.ts`) when it only needs to record events.

## Writing

| Method | Used for |
|---|---|
| `log(eventType, entityId, payload, entityType = 'User')` | Business events (`IAuditLogger`): account linking, role changes |
| `logAuthEvent(userId, 'USER_LOGIN' \| 'USER_LOGOUT' \| 'USER_LOGIN_FAILED')` | Sign-in events |
| `logPaymentTransaction(entityId, eventType, amount, currency)` | Payment events; `amount` always with its currency |
| `create(input)` / `createSafe(input)` | Admin actions with actor, IP and so on; `createSafe` never throws |

Payloads are redacted before they're stored: sensitive keys (passwords, tokens, secrets …) become
`[REDACTED]`, and emails and phone numbers inside text are masked.

## Reading (admins)

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/v1/admin/audit-logs` | Filtered, paginated list |
| `GET` | `/api/v1/admin/audit-logs/export` | Download as JSON or CSV (`format=json\|csv`) |
| `GET` | `/api/v1/admin/audit-logs/:id` | One entry |

Query parameters: `eventType`, `entityId`, `entityType`, `actorUserId`, `httpMethod`, `path`,
`statusCode`, `from`, `to`, `search`, `page`, `limit`, `lang`, `currency`, `format`. When an entry's
payload has `amount` and `currency`, the response adds `amountInDisplayCurrency` (rates from the
wallet). The admin site shows these under **Audit**.

## GDPR

`GET /api/v1/admin/compliance/gdpr/export/:userId` includes a user's entries (`entityId` or `actorUserId`).

## Tests

`audit.service.spec.ts` (unit) and `audit.integration.spec.ts` (needs the CI database).
