# Escrow Module — Architecture

## Escrow Lifecycle Pipeline

The escrow module implements a multi-stage financial pipeline that protects both employers and freelancers throughout a contract's lifespan. Funds are held in escrow from the moment a client initiates payment until milestones are approved, a dispute is resolved, or the contract is cancelled.

```
                   ┌──────────────────────────┐
                   │   Client initiates escrow │
                   │     (EscrowService)       │
                   └────────────┬─────────────┘
                                │
               ┌────────────────▼────────────────┐
               │   Wallet Balance Check (FOR UPDATE) │
               │   Row-level lock prevents double-spend │
               └────────────────┬────────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │                             │
        ┌────────▼────────┐          ┌─────────▼─────────┐
        │  Fully funded   │          │  Partial / No      │
        │  by wallet      │          │  wallet balance     │
        │  (status=FUNDED)│          │  (status=PENDING)   │
        └────────┬────────┘          └─────────┬─────────┘
                 │                             │
                 │                   ┌─────────▼─────────┐
                 │                   │  Chapa Checkout    │
                 │                   │  API Initialize    │
                 │                   └─────────┬─────────┘
                 │                             │
                 │                   ┌─────────▼─────────┐
                 │                   │  Webhook / Redirect│
                 │                   │  (POST / GET)      │
                 │                   └─────────┬─────────┘
                 │                             │
                 │                   ┌─────────▼─────────┐
                 │                   │  EscrowProcessor   │
                 │                   │  PROCESS_WEBHOOK   │
                 │                   └─────────┬─────────┘
                 │                             │
                 └──────────────┬──────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │      FUNDED              │
                   │  (funds secured in escrow)│
                   └────────────┬─────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │   Milestone Lifecycle     │
                   │   (approve / revise)      │
                   └────────────┬─────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │   3-Day Hold → Available  │
                   │   (AUTO_RELEASE job)      │
                   └────────────┬─────────────┘
                                │
                   ┌────────────▼─────────────┐
                   │  Contract Completion      │
                   │  (RELEASED / COMPLETED)   │
                   └──────────────────────────┘
```

## State Machine

### Escrow Transaction States

The `EscrowTransaction` record follows a strict state machine. Only valid transitions are permitted; any attempt to move to an illegal state is rejected with a `BadRequestException`.

```
                    ┌─────────┐
                    │ PENDING │
                    └────┬────┘
                         │
           ┌─────────────┼─────────────┐
           │             │             │
     (wallet full)  (webhook OK)  (webhook fail / 24h timeout)
           │             │             │
           ▼             ▼             ▼
      ┌────────┐   ┌────────┐   ┌──────────┐
      │ FUNDED │   │ FUNDED │   │ REFUNDED │
      └───┬────┘   └───┬────┘   └──────────┘
          │             │
          └──────┬──────┘
                 │
      ┌──────────┼──────────┐
      │          │          │
  (all MS     (cancel)  (dispute
   approved)              raised)
      │          │          │
      ▼          ▼          ▼
 ┌──────────┐ ┌──────────┐ ┌──────────┐
 │ RELEASED │ │ REFUNDED │ │ DISPUTED │
 └──────────┘ └──────────┘ └────┬─────┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
              (admin force  (admin force  (dispute
               release)      refund)     resolution)
                    │           │           │
                    ▼           ▼           ▼
              ┌──────────┐ ┌──────────┐ ┌──────────┐
              │ RELEASED │ │ REFUNDED │ │ RELEASED │
              └──────────┘ └──────────┘ │ REFUNDED │
                                        └──────────┘
```

### Valid Transitions

| From       | To         | Trigger                                      |
|------------|------------|----------------------------------------------|
| PENDING    | FUNDED     | Wallet fully covers amount **or** webhook `success` |
| PENDING    | REFUNDED   | Webhook `failure` / 24h unlock timeout       |
| FUNDED     | RELEASED   | All milestones approved / contract completed  |
| FUNDED     | REFUNDED   | Client cancels (no work started)             |
| FUNDED     | DISPUTED   | Dispute raised on contract                   |
| DISPUTED   | RELEASED   | Admin force-release / dispute resolution      |
| DISPUTED   | REFUNDED   | Admin force-refund / dispute resolution       |

### Cancellation Invariants

Cancellation is blocked when the escrow is in a terminal or active-work state:

- **Cannot cancel:** `IN_REVIEW`, `RELEASED`, `REFUNDED`, `DISPUTED`
- **Cannot cancel if work started:** Any milestone in `SUBMITTED`, `APPROVED`, or `IN_PROGRESS` status

## Wallet Integration

### Dual-Source Funding

Escrow supports a hybrid funding model where the employer's wallet balance is applied first, with any shortfall covered by the Chapa payment gateway.

```
  grossAmount = walletAppliedAmount + amountToPay (Chapa)
```

### Wallet Lock Mechanism

When wallet funds are partially applied, the employer's balance is **locked** (moved from `balance` to `lockedBalance`) to prevent double-spend. The locked funds follow one of three paths:

1. **Chapa payment succeeds** → `lockedBalance` decremented, wallet transaction recorded (funds spent)
2. **Chapa payment fails** → `lockedBalance` decremented, `balance` incremented (funds returned)
3. **24h timeout** → `UNLOCK_FUNDS` job fires, returns locked funds to available balance

### Concurrency Safety

The `initiate()` method uses PostgreSQL `FOR UPDATE` row-level locks on the employer wallet to prevent stale-read double-spend under concurrent requests. The database `CHECK` constraint (`balance >= 0`) serves as the last line of defense.

```sql
SELECT id, balance FROM employer_wallets WHERE "userId" = $1 FOR UPDATE
```

### Monetary Unit Convention

All monetary values are stored as **integer minor units** (santim for ETB, cents for USD). Wallets are always denominated in the platform base currency (ETB) — conversion happens only at payment-gateway boundaries (deposits via Stripe/PayPal) and at payout boundaries (withdrawals).

## Queue Job Architecture

All asynchronous work is dispatched via BullMQ to the `escrow` queue. Each job type is idempotent and safe to retry (3 attempts with exponential backoff by default).

```
┌──────────────────────────────────────────────────────┐
│                   ESCROW QUEUE                       │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ PROCESS_WEBHOOK  │  │ AUTO_RELEASE             │  │
│  │ (payment events) │  │ (3-day milestone hold)   │  │
│  └──────────────────┘  └──────────────────────────┘  │
│                                                      │
│  ┌──────────────────┐  ┌──────────────────────────┐  │
│  │ UNLOCK_FUNDS     │  │ CANCEL_CHAPA_PAYMENT     │  │
│  │ (24h timeout)    │  │ (cancellation cleanup)   │  │
│  └──────────────────┘  └──────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### PROCESS_WEBHOOK

Handles incoming Chapa/Telebirr payment callbacks. The processor:

1. **Validates payload** — rejects missing `reference`, `status`, or `tx_ref`
2. **Replay protection** — terminal-status payloads (`success`, `failure`, `cancelled`) must carry a timestamp within a 15-minute window
3. **Idempotency** — skips if escrow is already `FUNDED`
4. **Atomic funding** — marks escrow as `FUNDED`, publishes the gig, releases wallet locks, and creates event log — all within a single Prisma transaction
5. **Failure path** — marks escrow as `REFUNDED` and unlocks any wallet-applied funds

### AUTO_RELEASE

Moves milestone payouts from `pendingBalance` to `availableBalance` in the freelancer wallet after a configurable hold period (default: 72 hours / 3 days).

- **Hold check** — if the hold period hasn't elapsed, the job re-queues itself with the remaining delay
- **Milestone guard** — only processes milestones in `APPROVED` status (idempotency)
- **Pending balance guard** — atomic check inside transaction prevents double-release
- **Auto-complete** — if all contract milestones are approved after this release, the contract and escrow are automatically marked `COMPLETED` / `RELEASED`
- **Admin force-release** — supports synthetic `milestoneId` prefixed with `admin-force:` to skip milestone validation

### UNLOCK_FUNDS

Fires 24 hours after escrow initiation if Chapa payment was required alongside wallet funds. Returns locked employer wallet funds if the escrow is still in `PENDING` status (payment never completed).

- **Status guard** — no-op if escrow has transitioned away from `PENDING`
- **Balance guard** — verifies `lockedBalance >= amount` before decrementing

### CANCEL_CHAPA_PAYMENT

Best-effort call to the Chapa cancellation API after an escrow is cancelled or refunded. If the API call fails or is unavailable, an `EventLog` entry is created flagging the need for manual intervention.

## Webhook Security

### Signature Verification

The `EscrowController.webhook()` endpoint verifies the HMAC-SHA256 signature from Chapa on all POST requests:

```
hash = HMAC-SHA256(CHAPA_WEBHOOK_SECRET, rawBody)
```

- **Production** — missing signature, raw body, or secret results in `401 Unauthorized`
- **Development** — signature mismatches are logged as warnings but allowed through
- **GET requests** — signature verification is intentionally skipped; Chapa redirects users via GET after payment completion with no signature header

### Rate Limiting

The webhook endpoint is throttled at 5 requests per second (`@Throttle({ short: { ttl: 1_000, limit: 5 } })`) to prevent webhook replay attacks.

## Milestone Release Flow

### Standard Flow

```
  SUBMITTED → (client approves) → APPROVED → (3-day hold) → Available
```

1. Client calls `releaseMilestone()` — the milestone must be in `SUBMITTED` status and the contract must be `ACTIVE`
2. Milestone status is updated to `APPROVED` within a row-level-locked transaction (`FOR UPDATE` on the milestone row)
3. Freelancer wallet `pendingBalance` is incremented by the milestone amount
4. An `AUTO_RELEASE` job is queued with a 3-day delay and an idempotency key (`auto-release-${milestoneId}`)
5. After 3 days, the job moves funds from `pendingBalance` to `availableBalance`

### Revision Flow

```
  SUBMITTED → (client requests revision) → REVISION_REQUESTED → (freelancer resubmits) → SUBMITTED
```

- Client provides a reason; the milestone's `revisionCount` is incremented
- The freelancer is notified and must resubmit

## Platform Fee Calculation

```
  platformFee = round(grossAmount × PLATFORM_FEE_PCT)
  netAmount   = grossAmount − platformFee
```

The fee percentage is configurable via `PLATFORM_FEE_PCT` (default: 10%). The invariant `grossAmount = platformFee + netAmount` is enforced at initiation time.

## Admin Operations

### Force-Release

- **Guard:** escrow must be in `FUNDED` or `DISPUTED` status
- **Deduction:** already-released milestone amounts are subtracted to avoid double-crediting
- **3-day hold:** funds go to `pendingBalance` with a queued `AUTO_RELEASE` job (same flow as standard milestone release)
- **Synthetic milestone ID:** `admin-force:${escrowId}` — the processor skips milestone validation for these IDs

### Force-Refund

- **Guard:** escrow must be in `FUNDED` or `DISPUTED` status
- **Wallet refund:** wallet-applied amount is credited back to `balance` (lockedBalance already consumed during funding)
- **Chapa refund:** gateway-paid portion is queued via `CANCEL_CHAPA_PAYMENT` (async, best-effort)

## Contract Completion

Two paths to contract completion:

1. **Auto-complete** — triggered by `AUTO_RELEASE` processor when all milestones reach `APPROVED` status
2. **Manual complete** — either client or freelancer calls `completeContract()`

### Manual Completion Guards

- Contract must be `ACTIVE`
- No milestones in `SUBMITTED` status (all must be reviewed first)
- Both client and freelancer are authorized to trigger completion

### Atomic Updates

Both paths perform the following atomically:

- `Contract.status` → `COMPLETED`
- `EscrowTransaction.status` → `RELEASED` (if still `FUNDED`)
- `FreelanceJob.status` → `COMPLETED`
- `EventLog` entry created

## Notification Strategy

Every state transition emits notifications through the `NOTIFICATIONS` queue:

| Event                    | Channel  | Recipients        |
|--------------------------|----------|-------------------|
| `escrow.funded`          | In-App   | Client            |
| `escrow.cancelled`       | In-App   | Client            |
| `milestone.approved`     | EventLog | (audit trail)     |
| `milestone.revision_requested` | In-App | Freelancer   |
| `wallet.credited`        | In-App + Telegram | Freelancer |
| `wallet.unlocked`        | In-App   | Client            |
| `contract.completed`     | In-App   | Client + Freelancer |
| `escrow.admin-refund`    | In-App   | Client            |

All notification text is i18n-aware via `I18nService` with `lang` propagated from the HTTP request context. Background processor notifications use the default locale.

## Audit Trail

Every escrow state transition creates an `EventLog` entry with:

- `eventType` — namespaced event name (e.g., `escrow.funded`, `milestone.approved`)
- `entityId` — the affected record's UUID
- `entityType` — the Prisma model name
- `payload` — JSON with amounts, actor IDs, and context-specific data
- `processedBy` — `EscrowService` or `EscrowProcessor`

## Error Handling

| Scenario                          | Behavior                                        |
|-----------------------------------|-------------------------------------------------|
| Prisma constraint violation (P2002/P2003) | Caught → `BadRequestException` with wallet message |
| Chapa API unreachable             | Caught → `InternalServerErrorException`         |
| Chapa initialization failure      | Logged → provider-specific error re-thrown       |
| Individual webhook job failure    | Re-thrown for BullMQ retry (3 attempts)          |
| Chapa cancel API failure          | EventLog `manual-intervention` entry created     |
| Insufficient pending balance      | Transaction throws → BullMQ retry                |

## Configuration

| Environment Variable       | Default    | Description                                     |
|---------------------------|------------|-------------------------------------------------|
| `PLATFORM_FEE_PCT`        | `0.10`     | Platform fee as decimal fraction                 |
| `AUTO_RELEASE_HOURS`       | `72`       | Hours before pending funds become available      |
| `CHAPA_SECRET_KEY`         | —          | Chapa API secret key (required)                 |
| `CHAPA_WEBHOOK_SECRET`     | —          | HMAC secret for webhook signature verification   |
| `CHAPA_CALLBACK_URL`       | —          | URL Chapa sends webhook POST to                  |
| `CHAPA_RETURN_URL`         | —          | URL Chapa redirects user to after payment         |
| `FRONTEND_URL`             | `http://localhost:3000` | Frontend base URL for redirects        |
| `NODE_ENV`                 | —          | Controls webhook signature enforcement            |
