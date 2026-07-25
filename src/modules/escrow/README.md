# Escrow Module

## Purpose

The Escrow module implements a secure financial intermediary that holds employer funds in trust until contract milestones are delivered and approved. It eliminates payment risk for both parties — employers pay only for verified work, and freelancers are guaranteed payment upon milestone completion.

Designed as the financial backbone of the Beleqet marketplace, integrating with Chapa (ETB), employer/freelancer wallets, and the milestone-based contract system.

## Architecture Overview

```
Client Request
     │
     ▼
 Controller ◀─── ParseUUIDPipe + JwtAuthGuard + RolesGuard
     │
     ▼
   Service ────▶ PrismaService ($transaction)
     │                  │
     │                  ▼
     │           EmployerWallet (FOR UPDATE lock)
     │                  │
     │                  ▼
     │           EscrowTransaction (create/update)
     │                  │
     │                  ▼
     │           Chapa API (initialize payment)
     │
     ├──────────── EscrowProcessor (BullMQ worker)
     │                  │
     │          ┌───────┼───────┬───────────────┐
     │          │       │       │               │
     │          ▼       ▼       ▼               ▼
     │     WEBHOOK  AUTO_REL  UNLOCK    CANCEL_CHAPA
     │
     ▼
 Notification Queue ────▶ In-App + Telegram
```

## Pipeline Overview

The escrow lifecycle is a sequence of stages executed as funds move from employer to escrow to freelancer.

```
                  ┌──────────────────┐
                  │ Escrow Initiation │
                  │    (Stage 1)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Wallet Debit    │
                  │    (Stage 2)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Gateway Payment  │
                  │    (Stage 3)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ Webhook Confirm   │
                  │    (Stage 4)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ Milestone Release │
                  │    (Stage 5)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │   3-Day Hold      │
                  │    (Stage 6)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ Funds Available   │
                  │    (Stage 7)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │ Contract Complete │
                  │    (Stage 8)      │
                  └────────┬─────────┘
                           │
                           ▼
                  Escrow Released
```

### Stage 1 — Escrow Initiation

The employer initiates escrow on a gig that has an accepted bid (active contract). The agreed amount is pulled from the contract record and the platform fee is calculated.

- Input: `gigId` (freelance job with an accepted contract)
- Guard: contract must exist (bid accepted), no existing active escrow
- Output: escrow record created with `grossAmount`, `platformFee`, `netAmount`
- Fee: `platformFee = round(grossAmount × 0.10)` (configurable)

### Stage 2 — Wallet Debit

The employer's wallet balance is checked with a PostgreSQL `FOR UPDATE` row-level lock to prevent concurrent double-spend. Available balance is applied first.

- Full wallet coverage → escrow set to `FUNDED` immediately
- Partial wallet coverage → remaining amount sent to Chapa, wallet funds locked
- No wallet balance → full amount sent to Chapa
- Locked funds protected by `UNLOCK_FUNDS` job (24h timeout)

### Stage 3 — Gateway Payment

If Chapa payment is required, the Chapa Transaction Initialize API is called. The client receives a `checkoutUrl` to complete payment in-browser.

- Chapa payload includes sanitized job title, callback URL, and return URL
- `tx_ref` (UUID-based) links the Chapa transaction to the escrow record

### Stage 4 — Webhook Confirmation

Chapa sends a POST webhook (or redirects via GET) when payment completes. The `EscrowProcessor.PROCESS_WEBHOOK` job handles this asynchronously.

- HMAC-SHA256 signature verified on POST requests (production-enforced)
- 15-minute replay protection window for terminal-status payloads
- Idempotent: skips if escrow is already `FUNDED`

### Stage 5 — Milestone Release

When the employer approves a submitted milestone, the milestone amount is credited to the freelancer's `pendingBalance`.

- Milestone must be `SUBMITTED`; contract must be `ACTIVE`
- Row-level lock on milestone row prevents concurrent approval
- Alternatively, employer can request revision (`SUBMITTED` → `REVISION_REQUESTED`)

### Stage 6 — 3-Day Hold

An `AUTO_RELEASE` job is queued with a 72-hour delay (configurable). This hold period allows dispute filing before funds become withdrawable.

### Stage 7 — Funds Available

Funds move from `pendingBalance` to `availableBalance`. Freelancer is notified via in-app and Telegram.

### Stage 8 — Contract Completion

When all milestones are approved (auto-complete) or either party triggers manual completion, contract, escrow, and job are marked completed atomically.

## API Endpoints

### Client (Employer)

| Method | Path                                     | Auth        | Description                        |
|--------|------------------------------------------|-------------|------------------------------------|
| POST   | `/escrow/initiate/:gigId`                | JWT         | Initiate escrow for a gig          |
| GET    | `/escrow/my`                             | JWT         | List employer's escrows (paginated)|
| GET    | `/escrow/summary`                        | JWT         | Employer escrow summary stats      |
| GET    | `/escrow/:id`                            | JWT         | Single escrow detail               |
| POST   | `/escrow/milestones/:id/release`         | JWT         | Approve a submitted milestone      |
| DELETE | `/escrow/:escrowId/cancel`               | JWT         | Cancel escrow (refund)             |
| POST   | `/escrow/contracts/:contractId/complete` | JWT         | Complete contract manually         |

### Freelancer

| Method | Path                        | Auth | Description                           |
|--------|-----------------------------|------|---------------------------------------|
| GET    | `/escrow/freelancer/list`   | JWT  | List freelancer's escrows (paginated) |
| GET    | `/escrow/freelancer/summary`| JWT  | Freelancer escrow summary stats       |
| GET    | `/escrow/freelancer/:id`    | JWT  | Single escrow detail (freelancer view)|

### Admin

| Method | Path                                 | Auth        | Description                    |
|--------|--------------------------------------|-------------|--------------------------------|
| GET    | `/escrow/admin/:id`                  | JWT + ADMIN | Get any escrow detail          |
| POST   | `/escrow/admin/:id/force-release`    | JWT + ADMIN | Force-release to freelancer    |
| POST   | `/escrow/admin/:id/force-refund`     | JWT + ADMIN | Force-refund to client         |

### Webhook

| Method   | Path               | Auth          | Description                     |
|----------|--------------------|---------------|---------------------------------|
| POST/GET | `/escrow/callback` | HMAC / Public | Chapa payment webhook + redirect|

## Queue Jobs

| Job Name                  | Queue  | Delay | Description                                  |
|---------------------------|--------|-------|----------------------------------------------|
| `process-payment-webhook` | escrow | None  | Process Chapa webhook payload                |
| `auto-release-milestone`  | escrow | 72h   | Move funds pending → available after hold    |
| `unlock-escrow-funds`     | escrow | 24h   | Unlock wallet-locked funds on payment timeout|
| `cancel-chapa-payment`    | escrow | None  | Best-effort Chapa cancellation API call      |

## Key Invariants

| Invariant                                   | Enforcement Point                    |
|---------------------------------------------|--------------------------------------|
| `grossAmount = platformFee + netAmount`     | `EscrowService.initiate()`           |
| Wallet balance never goes negative          | `FOR UPDATE` lock + DB CHECK         |
| Idempotent webhook processing               | Status check before state change     |
| No cancellation after work starts           | Milestone status check               |
| All monetary values in minor units          | Convention: santim / cents           |

## File Responsibilities

| File                   | Purpose                                                        |
|------------------------|----------------------------------------------------------------|
| `escrow.controller.ts`| Route handlers, auth, webhook signature verification           |
| `escrow.service.ts`   | Core business logic — initiation, release, cancel, admin ops   |
| `escrow.processor.ts` | BullMQ worker — webhook, auto-release, unlock, Chapa cancel    |
| `escrow.module.ts`    | NestJS module — registers queues, imports WalletModule         |
| `tests/`              | Unit, E2E, and integration specs                               |

## Database Schema Changes

To support the Escrow module's features and performance requirements, the following changes were made to the Prisma schema:

| Change | Model | Reason |
|--------|-------|--------|
| Added `currency String @default("ETB")` | `Bid`, `Milestone`, `EscrowTransaction` | Supports multi-currency handling (e.g., ETB vs USD) at the bid, milestone, and escrow level (note: wallets remain strictly in ETB). |
| Added `revisionNotes` & `revisionCount` | `Milestone` | Supports the milestone revision flow, allowing clients to provide feedback (`SUBMITTED` → `REVISION_REQUESTED`) without creating new milestone records. |
| Added `@relation("EscrowFreelanceJob")` | `FreelanceJob`, `EscrowTransaction` | Explicitly names the 1:1 relation between a gig and its escrow transaction for clarity and query performance. |
| Added `@@index([gatewayRef])` | `EscrowTransaction` | Optimizes webhook processing lookups where Chapa/Telebirr callbacks provide the gateway reference to locate the escrow record. |
| Added `@@index([status, createdAt])` | `EscrowTransaction` | Optimizes employer and freelancer dashboard queries that filter escrows by status and sort by creation date. |

## Deployment Readiness

To ensure the Escrow module is ready for production deployment, the following configuration and infrastructure requirements have been met:

- **Database Migrations:** The `Dockerfile` entrypoint is configured to use `npx prisma migrate deploy` instead of `db push` for safe, non-destructive schema migrations crucial for financial tables.
- **Environment Variables:** All required payment gateway secrets (Chapa) and webhook callbacks are strictly validated and documented in `.env.example`.
- **Error Handling & Resilience:** Transactions are tightly scoped with Prisma `$transaction`. Webhook processors explicitly re-throw errors on failure to trigger BullMQ's exponential backoff and retry mechanisms, ensuring no dropped events.

