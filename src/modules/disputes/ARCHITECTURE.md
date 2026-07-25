# Disputes Module — Architecture

## Dispute Resolution Pipeline

The disputes module implements a structured conflict resolution system that freezes escrow funds when a disagreement arises between client and freelancer, then routes the case to platform administrators for binding resolution with fund distribution.

```
                   ┌───────────────────────────┐
                   │  Party raises dispute      │
                   │  (client or freelancer)     │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Ownership Verification    │
                   │  (contract party check)    │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Duplicate Guard           │
                   │  (one dispute per contract)│
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Atomic State Freeze       │
                   │  Contract  → DISPUTED      │
                   │  Escrow    → DISPUTED      │
                   │  Dispute   → created       │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Notification Dispatch     │
                   │  (both parties notified)   │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Admin Review Period       │
                   │  (evidence + reasoning)    │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Resolution + Fund Split   │
                   │  (4 resolution types)      │
                   └────────────┬──────────────┘
                                │
                   ┌────────────▼──────────────┐
                   │  Post-Resolution Cleanup   │
                   │  Contract → COMPLETED      │
                   │  Escrow → RELEASED/REFUNDED│
                   └───────────────────────────┘
```

## State Machine

### Dispute States

```
           ┌───────────┐
           │  (none)    │
           └─────┬─────┘
                 │
          (party raises)
                 │
           ┌─────▼─────┐
           │   OPEN     │
           │  (pending  │
           │   review)  │
           └─────┬─────┘
                 │
          (admin resolves)
                 │
           ┌─────▼─────┐
           │  RESOLVED  │
           │ (resolvedAt│
           │  + type)   │
           └───────────┘
```

### Contract Status Integration

When a dispute is raised, the contract transitions to `DISPUTED`. When resolved, it transitions to `COMPLETED` regardless of resolution type — the contract is considered terminally closed.

```
  ACTIVE ──(dispute raised)──▶ DISPUTED ──(admin resolves)──▶ COMPLETED
```

### Escrow Status Integration

The escrow status mirrors the dispute lifecycle:

```
  FUNDED ──(dispute raised)──▶ DISPUTED ──▶ RELEASED (freelancer gets funds)
                                          ──▶ REFUNDED (client gets refund)
```

## Resolution Types

The admin has four resolution options, each with distinct fund distribution logic:

### RELEASE_TO_FREELANCER

Full release of escrow net amount to the freelancer. The client receives nothing.

```
  freelancerAmount = escrow.netAmount
  walletRefund     = 0
  chapaRefund      = 0
  escrowStatus     = RELEASED
```

### REFUND_TO_CLIENT

Full refund to the client. The freelancer receives nothing.

```
  freelancerAmount = 0
  walletRefund     = escrow.walletAppliedAmount
  chapaRefund      = grossAmount − walletAppliedAmount
  escrowStatus     = REFUNDED
```

### SPLIT_50_50

Equal split of the gross amount between both parties. The platform absorbs its fee since neither party fully completed the work.

```
  halfGross        = floor(grossAmount / 2)
  freelancerAmount = halfGross
  clientRefund     = grossAmount − freelancerAmount
  walletRefund     = min(clientRefund, walletAppliedAmount)
  chapaRefund      = clientRefund − walletRefund
  escrowStatus     = RELEASED
```

**Invariant:** `freelancerAmount + clientRefund = grossAmount`

### PARTIAL_RELEASE

Configurable percentage split. The freelancer receives `partialPercentage%` of the net amount; the client receives the remainder of the gross (including the platform fee portion of the unreleased side).

```
  freelancerAmount = round(netAmount × partialPercentage / 100)
  clientRefund     = grossAmount − freelancerAmount
  walletRefund     = min(clientRefund, walletAppliedAmount)
  chapaRefund      = clientRefund − walletRefund
  escrowStatus     = RELEASED
```

- `partialPercentage` must be between 1 and 99 (validated in DTO)

## Fund Distribution Architecture

### Dual-Channel Refund

Client refunds follow two channels based on the original payment source:

1. **Wallet refund** (synchronous) — credited directly to `employerWallet.balance` within the Prisma transaction. Since the escrow was `FUNDED` before becoming `DISPUTED`, `lockedBalance` was already consumed — only `balance` is incremented.

2. **Chapa refund** (asynchronous) — queued via the `CANCEL_CHAPA_PAYMENT` job on the escrow queue. This is best-effort; if Chapa's API fails, an `EventLog` entry flags manual intervention.

```
  totalClientRefund = walletRefundAmount + chapaRefundAmount
  
  walletRefundAmount ──▶ employerWallet.balance (immediate, in-transaction)
  chapaRefundAmount  ──▶ CANCEL_CHAPA_PAYMENT job (async, best-effort)
```

### Freelancer Credit

Freelancer funds go to `pendingBalance` (same as standard milestone releases). The dispute resolution does **not** automatically queue an `AUTO_RELEASE` job — the admin may separately force-release if needed.

## Transaction Atomicity

The `resolveDispute()` method wraps all state mutations in a single Prisma `$transaction`:

1. Update `Dispute` record (resolution, resolvedAt, resolvedById)
2. Update `EscrowTransaction` status (RELEASED or REFUNDED)
3. Credit `FreelancerWallet.pendingBalance` (if freelancerAmount > 0)
4. Create `WalletTransaction` record (freelancer side)
5. Credit `EmployerWallet.balance` (if walletRefundAmount > 0)
6. Create `EmployerWalletTransaction` record (client side)
7. Update `Contract.status` → COMPLETED
8. Create `EventLog` entry with full resolution payload

If any step fails, the entire transaction rolls back — no partial fund distribution is possible.

## Notification Strategy

| Event              | Recipients          | Channel | Content                                    |
|--------------------|---------------------|---------|--------------------------------------------|
| `dispute.raised`   | Other party         | In-App  | Who raised it, contract ID, truncated reason |
| `dispute.raised`   | Raising party       | In-App  | Confirmation that dispute was submitted     |
| `dispute.resolved` | Client              | In-App  | Resolution type + refund/closure detail     |
| `dispute.resolved` | Freelancer          | In-App  | Resolution type + release/closure detail    |

Notification text is i18n-aware. The `lang` parameter is propagated from the HTTP request's `Accept-Language` / `x-custom-lang` header or `?lang=` query param.

## Validation & Guards

### Create Dispute

| Guard                          | Error                                   |
|--------------------------------|-----------------------------------------|
| Contract exists                | `404 NotFoundException`                 |
| User is party to contract      | `404 NotFoundException`                 |
| No existing dispute            | `400 BadRequestException`              |
| Contract in ACTIVE or DISPUTED | `400 BadRequestException`              |

### Resolve Dispute

| Guard                          | Error                                   |
|--------------------------------|-----------------------------------------|
| Dispute exists                 | `404 NotFoundException`                 |
| Not already resolved           | `400 BadRequestException`              |
| Escrow exists for contract     | `400 BadRequestException`              |
| Escrow in DISPUTED status      | `400 BadRequestException`              |
| PARTIAL_RELEASE: % is 1–99     | `400 BadRequestException`              |

## Audit Trail

Every dispute lifecycle event creates an `EventLog` entry:

| Event Type         | Entity Type | Payload                                              |
|--------------------|-------------|------------------------------------------------------|
| `dispute.raised`   | Dispute     | disputeId, contractId, raisedBy, reason              |
| `dispute.resolved` | Dispute     | disputeId, contractId, resolution, resolutionType, resolvedBy, escrowId, escrowStatus, freelancerAmount, walletRefundAmount, chapaRefundAmount |

## Evidence System

Disputes support up to 10 evidence URLs (screenshots, documents, etc.) submitted by the raising party at creation time. Evidence URLs are:

- Validated as proper URLs (`@IsUrl()`)
- Capped at 10 entries (`@ArrayMaxSize(10)`)
- Stored as a JSON array on the `Dispute` record
- Available to admin reviewers via the `fetchAllDisputes()` endpoint
