# Admin Stats — Phase 1 Data Map

**Module:** Admin Stats (Admin & Control)  
**Repo:** `beleqet-ecosystem-updated`  
**Date:** 2026-08-04  
**Goal:** Map every number the admin dashboard will need to a concrete table / field / query path.

Existing stub: `src/modules/admin-stats` (`GET /admin-stats/dashboard`) already returns `totalUsers`, `totalRevenue`, `activeContracts`, `completedJobs`. This map covers what is available today, what that stub misses, and what must be added before Phase 2 APIs.

---

## 1. How admin access works

There is **no `isAdmin` boolean**. Admin identity is dual-layer:

| Layer | Where | How to tell |
| --- | --- | --- |
| Platform role | `users.role` (`UserRole` enum) | `role === 'ADMIN'` |
| Fine-grained RBAC | `roles` + `permissions` + `User.rbacRoles` | Permission actions e.g. `view:stats` |

**Enum (`prisma/schema.prisma`):**

```
UserRole: ADMIN | EMPLOYER | JOB_SEEKER | FREELANCER
```

**Guard path:** `JwtAuthGuard` → `RolesGuard`  
- `@Roles('ADMIN')` checks JWT `user.role`  
- `@RequirePermissions('view:stats')` loads `user.rbacRoles.permissions` (Redis-cached 5 min)

**Seed (`prisma/seed.ts`):** creates permission `view:stats` and system role `ADMIN` with all permissions; optionally upserts user from `ADMIN_EMAIL` / `ADMIN_PASSWORD` with both `role: ADMIN` and `rbacRoles: ADMIN`.

**Bootstrap (`src/main.ts`):** same env-based admin upsert on app start.

**Dashboard gate (already wired):**

```ts
@Roles('ADMIN')
@RequirePermissions('view:stats')
```

---

## 2. Domain map — what “Projects” means here

This platform is **jobs + freelance**, not a generic “projects” table.

| Dashboard concept | Primary tables | Notes |
| --- | --- | --- |
| Employment jobs | `jobs` (`Job`) | Owned via `Company` → `User` |
| Freelance projects | `freelance_jobs` (`FreelanceJob`) | Owner = `clientId` → `User` |
| Active work / progress | `contracts`, `milestones` | Contract lifecycle after a bid is accepted |
| Employer pipeline | `applications` | Not “projects”, but activity / funnel |

For admin “project progress”, prefer **`FreelanceJob` + `Contract`**. Use **`Job`** for employment-side volume.

---

## 3. Queryable sources (by dashboard domain)

### 3.1 Users — `users`

| Metric needed | Field / query | Available? |
| --- | --- | --- |
| Total count | `COUNT(*)` / `COUNT(*) WHERE isActive` | Yes |
| Registration date | `createdAt` | Yes |
| Last login | — | **NO dedicated column** (see Gaps) |
| Role | `role` (`UserRole`) | Yes |
| Active / inactive | `isActive` | Yes |
| Extra useful | `emailVerified`, `kycVerified`, `updatedAt`, `rbacRoles` | Yes |

**Related:** `companies` (1:1 employer profile), `refresh_tokens` (session presence), `oauth_accounts`.

**Proxy for “recently active” (weak):** max `refresh_tokens.createdAt` per user, or latest `events_log` row where `entityType = 'User'`.

---

### 3.2 Jobs / Projects

#### Employment — `jobs`

| Metric | Field | Available? |
| --- | --- | --- |
| Total count | `id` | Yes |
| Status | `status` (`JobStatus`) | Yes — **different labels than the brief** |
| Creation date | `createdAt` | Yes |
| Owner | `companyId` → `companies.userId` → `users` | Yes |

**Actual statuses:** `DRAFT` \| `PUBLISHED` \| `CLOSED` \| `ARCHIVED`  
**Brief asked for:** draft / active / completed / on hold → map as:

| Brief | Closest existing |
| --- | --- |
| draft | `DRAFT` |
| active | `PUBLISHED` |
| completed | `CLOSED` (or `filled = true`) |
| on hold | **none** — no hold status |

#### Freelance — `freelance_jobs`

| Metric | Field | Available? |
| --- | --- | --- |
| Total count | `id` | Yes |
| Status | `status` (`FreelanceJobStatus`) | Yes |
| Creation date | `createdAt` | Yes |
| Owner | `clientId` → `users` | Yes |

**Statuses:** `DRAFT` \| `FUNDED` \| `OPEN` \| `IN_PROGRESS` \| `COMPLETED` \| `CANCELLED`

#### Contracts / progress — `contracts`, `milestones`

| Metric | Field | Available? |
| --- | --- | --- |
| Active / completed | `contracts.status` | Yes: `ACTIVE` \| `COMPLETED` \| `DISPUTED` \| `CANCELLED` |
| Timeline | `startedAt`, `completedAt` | Yes |
| Milestone progress | `milestones.status` | Yes |

Existing stub already uses `contracts` (`ACTIVE`) and `freelance_jobs` (`COMPLETED`).

---

### 3.3 Transactions / Payments / Revenue

Money is **split across several tables** — do not rely on `payments` alone.

| Source table | Amount | Date | Type | Status | Use for dashboard |
| --- | --- | --- | --- | --- | --- |
| `payments` | `amount`, `currency` | `createdAt`, `refundedAt` | Stripe/PayPal only (`PaymentProvider`) | `PaymentStatus` | Card/gateway payments |
| `escrow_transactions` | `grossAmount`, **`platformFee`**, `netAmount` | `createdAt`, `fundedAt`, `releasedAt` | Escrow fund/release/refund via Chapa | `EscrowStatus` | **Primary freelance GMV + platform revenue** |
| `subscription_transactions` | `amount`, `currency` | `createdAt` | Recurring billing | `PaymentStatus` | Subscription revenue |
| `wallet_transactions` | `amount` | `createdAt` | `WalletTransactionType` | (type implies direction) | Freelancer wallet ledger |
| `employer_wallet_transactions` | `amount` | `createdAt` | same enum | same | Employer wallet ledger |
| `campaigns` | `spentAmount`, budgets | `createdAt` | Ad spend | `CampaignStatus` | Promo revenue / spend |

**`PaymentStatus`:** `PENDING` \| `PROCESSING` \| `SUCCEEDED` \| `FAILED` \| `REFUNDED` \| `PARTIALLY_REFUNDED` \| `CANCELLED`

**`EscrowStatus`:** `PENDING` \| `FUNDED` \| `IN_REVIEW` \| `RELEASED` \| `REFUNDED` \| `DISPUTED`

**Revenue recommendation (platform income):**

1. Sum `escrow_transactions.platformFee` where status ∈ (`RELEASED`, optionally `FUNDED`) — **not** `netAmount` (that is freelancer payout).  
2. Add `payments.amount` where `status = SUCCEEDED` (and subtract refunds).  
3. Add `subscription_transactions.amount` where `status = SUCCEEDED`.  
4. Optionally include campaign spend if product treats ads as revenue.

**⚠️ Bug in current stub:** `AdminStatsService` sums `escrowTransaction.netAmount` for `totalRevenue`. That understates/misstates platform revenue; use `platformFee` (and other fee sources above).

**Chapa:** used for escrow/withdrawals via `src/modules/chapa` + `escrow_transactions.gatewayRef`. It is **not** a value on `Payment.provider` (`STRIPE` \| `PAYPAL` only).

---

### 3.4 Activity / login / audit logs

| Source | Columns relevant to activity | Available? |
| --- | --- | --- |
| `events_log` (`EventLog`) | `eventType`, `entityId`, `entityType`, `payload`, `processedBy`, `createdAt` | Yes — **canonical audit trail** |
| `refresh_tokens` | `userId`, `createdAt`, `expiresAt` | Yes — session proxy |
| `search_histories` | `userId`, `searchTerm`, `searchedAt` | Yes — search activity |
| `notifications` | `userId`, `type`, `createdAt` | Yes — secondary signal |
| Dedicated login log table | — | **No** |
| `users.lastLogin` | — | **No** |
| Legacy `audit_logs` migration | user_id, action, entity, timestamp… | Table may exist in DB; **Prisma model `AuditLog` is missing** from current schema (see Gaps) |

**Auth events today:**

- `auth.login.failed` / `auth.login.success` are **EventEmitter** events.  
- Failed logins may produce `ANOMALY_DETECTED` in `events_log` (brute-force only).  
- Success handler only clears in-memory failure counters — **does not persist a login row**.  
- `AuditService.logAuthEvent('USER_LOGIN' | …)` exists but is **not wired** from the main login path.

**Writable activity for dashboard “user activity” charts today:**

- Registrations: `users.createdAt`  
- Job/freelance/application volume over time  
- Escrow / payment events in `events_log`  
- Anomalies in `events_log`  
- **Not** reliable DAU/MAU from login history without new instrumentation

---

## 4. Full table inventory (Prisma models → SQL maps)

Queryable models in `prisma/schema.prisma` (high-signal for Admin Stats marked ★):

| Model | Table | Admin Stats relevance |
| --- | --- | --- |
| User ★ | `users` | Counts, roles, active |
| Permission / Role ★ | `permissions` / `roles` | Admin authorization |
| Company | `companies` | Job ownership |
| Job ★ | `jobs` | Employment volume/status |
| Application ★ | `applications` | Funnel |
| FreelanceJob ★ | `freelance_jobs` | Project volume/status |
| Bid | `bids` | Marketplace activity |
| Contract ★ | `contracts` | Active work |
| Milestone | `milestones` | Progress depth |
| EscrowTransaction ★ | `escrow_transactions` | GMV + fees |
| FreelancerWallet / WalletTransaction | wallets + txs | Liquidity / payouts |
| EmployerWallet / EmployerWalletTransaction | employer wallets + txs | Funding side |
| Dispute | `disputes` | Ops risk |
| Payment ★ | `payments` | Gateway revenue |
| Plan / Subscription / SubscriptionTransaction ★ | billing tables | MRR / sub revenue |
| WebhookEvent | `webhook_events` | Ops integrity |
| EventLog ★ | `events_log` | Activity / audit |
| RefreshToken | `refresh_tokens` | Weak “last session” |
| SearchHistory | `search_histories` | Engagement |
| Campaign / AdEvent | `campaigns` / `ad_events` | Ad revenue & CTR |
| ContactMessage | `contact_messages` | Support volume |
| KycVerification | `kyc_verifications` | Trust metrics |
| Notification | `notifications` | Engagement |
| Interview / VideoInterview | interview tables | Hiring activity |
| Referral | `referrals` | Growth |
| + others (forum, FAQ, salary, files, 2FA, etc.) | — | Secondary / out of Phase 1 KPIs |

---

## 5. Existing Admin Stats stub → source mapping

| Response field | Current source | Correct / recommended source |
| --- | --- | --- |
| `totalUsers` | `users` where `isActive: true` | OK; also expose inactive / by-role breakdowns |
| `totalRevenue` | Sum `escrow.netAmount` (RELEASED) | **Change to** `platformFee` + payments + subscription txs |
| `activeContracts` | `contracts` where `ACTIVE` | OK |
| `completedJobs` | `freelance_jobs` where `COMPLETED` | OK; separately count employment `jobs` if needed |
| `currency` | query param (default ETB) | OK via wallet FX helper |

Controller: `src/modules/admin-stats/admin-stats.controller.ts`  
Service: `src/modules/admin-stats/admin-stats.service.ts`

Related admin surfaces (not stats, but same gate):

- `src/modules/admin` — user CRUD, disputes, broadcast  
- `src/modules/audit` + `src/modules/audit-log` — read `events_log`  
- `src/modules/rbac` — roles/permissions CRUD  

---

## 6. Gaps & flags (act before or during Phase 2)

### Critical / blocking for accurate dashboard KPIs

| # | Gap | Impact | Suggested fix |
| --- | --- | --- | --- |
| 1 | **No `lastLoginAt` (or equivalent)** on `User` | Cannot show last login / true DAU from users table | Add `lastLoginAt DateTime?` and set it in `AuthService.login` / OAuth success; **or** persist `USER_LOGIN` into `events_log` on every success |
| 2 | **Successful logins not persisted** | Activity charts under-count; `logAuthEvent` unused on happy path | Call `AuditService.logAuthEvent('USER_LOGIN', userId, …)` from login |
| 3 | **Revenue uses `netAmount`** in stub | Wrong revenue number | Switch aggregation to `platformFee` (+ other revenue tables) |
| 4 | **Schema drift: `User.auditLogs → AuditLog[]` but no `AuditLog` model** | Prisma client / migrate risk; dual audit concepts | Either restore `AuditLog` model matching `audit_logs` migration, or remove the relation and standardize on `EventLog` |
| 5 | **`User.promotionCampaigns → PromotionCampaign[]` with no model** | Same schema integrity risk | Point to `Campaign` or remove orphan relation |
| 6 | **Duplicate `rbacRoles` field** declared twice on `User` | Schema may fail validate | Deduplicate relation |

### Product / mapping mismatches (document, don’t invent data)

| # | Gap | Impact |
| --- | --- | --- |
| 7 | Job statuses ≠ draft/active/completed/on hold | Map explicitly in API docs / UI labels |
| 8 | No employment “on hold” | Need new enum value **or** omit from charts |
| 9 | Chapa escrow outside `payments` | Revenue queries must union escrow + payments + subscriptions |
| 10 | Multi-currency (`ETB` / `USD` / …) | All money aggregates need FX (stub already uses `WalletService.convertCurrency`) |

### Nice-to-have (not blocking Phase 1 map)

- Dedicated `login_events` table if volume/analytics needs grow beyond `events_log`  
- Materialized daily rollup table for dashboard performance  
- Confirm whether `audit_logs` DB table should be dropped or backfilled into `events_log`

---

## 7. Recommended query plan for Phase 2 endpoints

```
GET /admin-stats/dashboard
  users:      COUNT users [group by role, isActive]; registrations by day (createdAt)
  projects:   COUNT jobs by JobStatus; COUNT freelance_jobs by FreelanceJobStatus;
              COUNT contracts by ContractStatus
  revenue:    SUM escrow.platformFee (RELEASED) + SUM payments (SUCCEEDED)
              - refunds + SUM subscription_transactions (SUCCEEDED)
              [convert → query.currency]
  activity:   IF lastLoginAt exists → DAU/MAU;
              ELSE → registrations + eventLog counts by eventType + refresh_token proxies
              + applications / bids createdAt histograms
```

**Auth for all:** JWT + `Roles('ADMIN')` + `RequirePermissions('view:stats')`.  
**GDPR:** aggregates only; never return email/name/IP in stats payloads (PII stays in audit module with scrubbing).

---

## 8. Module / folder touchpoints

| Area | Path |
| --- | --- |
| Schema | `prisma/schema.prisma` |
| Seed / admin + `view:stats` | `prisma/seed.ts` |
| Stats API (extend) | `src/modules/admin-stats/` |
| Admin ops | `src/modules/admin/` |
| RBAC | `src/modules/rbac/`, `src/common/guards/roles.guard.ts` |
| Audit / activity | `src/modules/audit/`, `src/modules/audit-log/`, `EventLog` |
| Auth / login instrumentation | `src/modules/auth/auth.service.ts` |
| Escrow revenue | `src/modules/escrow/` |
| Gateway payments | `src/modules/payments/` |
| Subscriptions | `src/modules/subscriptions/` |
| Wallets / FX | `src/modules/wallet/` |

---

## 9. Phase 1 verdict

| Domain | Can we build charts now? | Blocker |
| --- | --- | --- |
| Users (count, role, active, registered) | **Yes** | Last login missing |
| Projects / jobs progress | **Yes** (with status mapping) | No “on hold” for employment jobs |
| Revenue / transactions | **Yes** (multi-table) | Fix fee field; union payment sources |
| User activity / logins | **Partial** | Must add login persistence or `lastLoginAt` |

**Phase 1 complete:** every dashboard number has an identified source or an explicit gap. Next: Phase 2 API design + implementation on top of this map, including gap fixes #1–#3 as highest priority for correctness.
