# Disputes Module

## Purpose

The Disputes module provides a structured conflict resolution system for the Beleqet freelance marketplace. When a client or freelancer disagrees on deliverable quality, payment terms, or contract expectations, either party can raise a dispute that freezes escrow funds and escalates the case to platform administrators for binding resolution.

Designed to integrate tightly with the Escrow module — disputes lock funds during review and distribute them according to the admin's resolution decision.

## Architecture Overview

```
Client Request
     │
     ▼
 Controller ◀─── DTO validation + JwtAuthGuard + RolesGuard
     │
     ▼
   Service ────▶ PrismaService ($transaction)
     │                  │
     │          ┌───────┼───────────────────┐
     │          │       │                   │
     │          ▼       ▼                   ▼
     │     Dispute   Contract         EscrowTransaction
     │     (create)  (→ DISPUTED)     (→ DISPUTED)
     │
     ├──── Admin Resolution
     │          │
     │          ▼
     │     Fund Distribution
     │     ┌────┴────────────────────┐
     │     │                        │
     │     ▼                        ▼
     │  FreelancerWallet       EmployerWallet
     │  (pendingBalance)       (balance refund)
     │
     ▼
 Notification Queue ────▶ In-App
```

## Pipeline Overview

The dispute lifecycle follows a linear pipeline from filing through admin resolution.

```
                  ┌──────────────────┐
                  │ Dispute Filing    │
                  │    (Stage 1)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  State Freeze     │
                  │    (Stage 2)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Admin Review     │
                  │    (Stage 3)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Resolution       │
                  │    (Stage 4)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Fund Split       │
                  │    (Stage 5)      │
                  └────────┬─────────┘
                           │
                  ┌────────▼─────────┐
                  │  Cleanup          │
                  │    (Stage 6)      │
                  └────────┬─────────┘
                           │
                           ▼
                  Case Closed
```

### Stage 1 — Dispute Filing

Either the client or freelancer submits a dispute against an active contract. The request includes a detailed reason (50–2000 characters) and optional evidence URLs.

- Input: `contractId`, `reason`, optional `evidenceUrls` (up to 10)
- Guard: user must be a party to the contract
- Guard: no existing dispute for this contract (one dispute per contract)
- Guard: contract must be in `ACTIVE` or `DISPUTED` status

### Stage 2 — State Freeze

Within a single Prisma transaction, the system atomically:

- Creates the `Dispute` record
- Transitions the `Contract` status to `DISPUTED`
- Transitions the `EscrowTransaction` status to `DISPUTED`
- Creates an `EventLog` audit entry

Both parties receive in-app notifications.

### Stage 3 — Admin Review

Administrators access the dispute through the admin panel, reviewing:

- Dispute reason and evidence URLs
- Contract details (client, freelancer, milestones)
- Escrow amounts and payment history

This stage is manual — the module provides read endpoints but no automated review logic.

### Stage 4 — Resolution

The admin selects one of four resolution types and provides a written resolution:

| Type                    | Freelancer Gets              | Client Gets                    |
|-------------------------|------------------------------|--------------------------------|
| `RELEASE_TO_FREELANCER` | 100% of net amount           | Nothing                        |
| `REFUND_TO_CLIENT`      | Nothing                      | 100% of gross amount           |
| `SPLIT_50_50`           | 50% of gross                 | 50% of gross                   |
| `PARTIAL_RELEASE`       | X% of net (admin-specified)  | Remainder of gross             |

### Stage 5 — Fund Split

Funds are distributed atomically within a Prisma transaction:

- Freelancer credits go to `pendingBalance` (with a wallet transaction record)
- Client refunds split between wallet (immediate) and Chapa (async queue job)
- All amounts computed from escrow `grossAmount`, `netAmount`, and `walletAppliedAmount`

### Stage 6 — Cleanup

After fund distribution:

- Contract status → `COMPLETED`
- Escrow status → `RELEASED` or `REFUNDED` (based on resolution type)
- Both parties notified with resolution-specific messaging
- Chapa refund job queued if gateway-paid portion needs refunding

## API Endpoints

### User Endpoints

| Method | Path                          | Auth | Description                              |
|--------|-------------------------------|------|------------------------------------------|
| POST   | `/disputes`                   | JWT  | Raise a dispute on a contract            |
| GET    | `/disputes/my`                | JWT  | List user's disputes (as party or raiser)|
| GET    | `/disputes/contract/:contractId` | JWT | Get dispute for a specific contract   |

### Admin Endpoints

| Method | Path                          | Auth        | Description                    |
|--------|-------------------------------|-------------|--------------------------------|
| GET    | `/disputes/all`               | JWT + ADMIN | List all disputes              |
| PATCH  | `/disputes/:disputeId/resolve`| JWT + ADMIN | Resolve with fund distribution |

## DTOs

### CreateDisputeDto

| Field         | Type     | Validation                          | Required |
|---------------|----------|-------------------------------------|----------|
| `contractId`  | string   | `@IsString()`                       | Yes      |
| `reason`      | string   | `@MinLength(50)` `@MaxLength(2000)` | Yes      |
| `evidenceUrls`| string[] | `@IsUrl()` each, `@ArrayMaxSize(10)`| No       |

### ResolveDisputeDto

| Field              | Type   | Validation                                   | Required |
|--------------------|--------|----------------------------------------------|----------|
| `resolution`       | string | `@MinLength(10)` `@MaxLength(2000)`          | Yes      |
| `resolutionType`   | enum   | `DisputeResolution` enum                     | Yes      |
| `partialPercentage`| number | `@Min(1)` `@Max(99)`, only for PARTIAL_RELEASE | No    |

## Key Invariants

| Invariant                                        | Enforcement                          |
|--------------------------------------------------|--------------------------------------|
| One dispute per contract                         | `findUnique({ contractId })` check   |
| Only contract parties can raise disputes         | Contract query with `OR [clientId, freelancerId]` |
| Only ACTIVE/DISPUTED contracts can be disputed   | Status check before creation         |
| Resolution is idempotent (resolvedAt guard)       | `if (dispute.resolvedAt)` check      |
| Escrow must be DISPUTED before resolution        | `escrow.status !== 'DISPUTED'` guard |
| PARTIAL_RELEASE requires valid percentage        | DTO validation + service-level check |
| Fund distribution is atomic                      | Single `prisma.$transaction`         |
| `freelancerAmount + clientRefund ≤ grossAmount`  | Computed from escrow fields          |

## Cross-Module Dependencies

| Dependency         | Usage                                              |
|--------------------|----------------------------------------------------|
| `PrismaService`    | All database operations (transactions, queries)     |
| `I18nService`      | Exception messages and notification text            |
| `ConfigService`    | (injected, available for future configuration)      |
| `NOTIFICATIONS` queue | In-app notification dispatch                     |
| `ESCROW` queue     | Chapa refund job dispatch (`CANCEL_CHAPA_PAYMENT`)  |

## File Responsibilities

| File                      | Purpose                                              |
|---------------------------|------------------------------------------------------|
| `disputes.controller.ts`  | Route handlers — auth, DTO validation, lang extraction |
| `disputes.service.ts`     | Core business logic — create, resolve, query disputes |
| `disputes.module.ts`      | NestJS module — registers notification + escrow queues |
| `dto/create-dispute.dto.ts` | Input validation for dispute creation              |
| `dto/resolve-dispute.dto.ts` | Input validation for admin resolution + enum definition |
| `tests/`                  | Unit, E2E, and integration specs                     |

## Database Schema Changes

To support the Disputes module's resolution logic and auditing, the following changes were made to the Prisma schema:

| Change | Model | Reason |
|--------|-------|--------|
| Added `DisputeResolution` enum | (New Enum) | Defines the four strict resolution types (`RELEASE_TO_FREELANCER`, `REFUND_TO_CLIENT`, `SPLIT_50_50`, `PARTIAL_RELEASE`) that dictate fund distribution logic. |
| Added `resolutionType` field | `Dispute` | Stores the selected `DisputeResolution` enum value for the resolved case. |
| Added `resolvedById` field & relation | `Dispute` | Links the dispute to the specific admin user who resolved it for audit and accountability purposes. |
| Added `raisedBy` relation | `Dispute` | Explicitly links the dispute to the user (client or freelancer) who filed it. |
| Added back-relations (`raisedDisputes`, `resolvedDisputes`) | `User` | Required by Prisma for the relations established on the `Dispute` model. |

## Deployment Readiness

To ensure the Disputes module is ready for production deployment, the following configuration and infrastructure requirements have been met:

- **Database Migrations:** Relies on the global `Dockerfile` update using `npx prisma migrate deploy` to safely apply the new `DisputeResolution` enum and relation changes without data loss.
- **Error Handling & Resilience:** The module relies on atomic Prisma `$transaction` blocks for all fund distributions. If any part of a complex split resolution fails, the entire transaction rolls back cleanly. Queue-based Chapa refund jobs re-throw errors to trigger BullMQ retries for eventual consistency.

