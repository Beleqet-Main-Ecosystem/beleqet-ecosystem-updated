# Campaigns / Ads — Data Model (Phase 1)

## Entities

| Table | Purpose | Mutability |
|---|---|---|
| `campaigns` | Paid boost campaigns targeting a job, proposal, or gig | Soft lifecycle via `status` — **never hard-delete** |
| `ad_events` | Impression / click / conversion telemetry | **Append-only** — no updates, no deletes |

## Polymorphic targets

`targetType` + `targetId` (no Prisma FK to the target row):

| `CampaignTargetType` | Resolves to |
|---|---|
| `JOB` | `jobs.id` |
| `PROPOSAL` | `bids.id` (freelance proposals) |
| `GIG` | `freelance_jobs.id` |

## Money

All budget / bid / spent fields are `Int` minor units (santim / cents), matching `Payment`, `EscrowTransaction`, and wallets. `currencyCode` is ISO 4217 (default `ETB`).

## GDPR

`ad_events` stores `hashedIp`, `hashedUserAgent`, and a pseudonymous `sessionRef` — never raw IP, UA, or user id.

**Retention:** `AD_EVENTS_RETENTION_DAYS = 90` (`src/modules/campaigns/ad-events-retention.ts`). A daily cron purges rows older than 90 days.

**Account deletion:** `GdprGuardService.executeDataErasure` deletes the owner's `ad_events`, then marks their campaigns `COMPLETED` and clears payment refs / wallet reservation fields.

---

## Phase 2 — Auction, budget, payments

### Ranking
- `score = bid_amount * quality_score`
- `quality_score` reuses `AiFeedService.scoreQueryRelevance` (same 0–100 relevance signal as the personal feed)
- Results cached ~45s per `(query, targetType, limit)` via `CacheService`
- Tie-break: newer `createdAt` wins; then `campaignId` desc

### Budget
- Billable events: CPC → click, CPM → impression
- Deduction uses `SELECT … FOR UPDATE` + conditional `updateMany` so concurrent charges cannot overspend
- Midnight cron resets `dailySpent` and reactivates `EXHAUSTED` campaigns that still have total budget left

### Payments
- Create reserves/authorizes `totalBudget` via employer wallet lock + optional Chapa checkout
- FX rate (`fxRate`, `fxFromCurrency`, `fxToCurrency`) stored at write time
- Webhook `POST /api/v1/campaigns/webhook/chapa`: `PENDING_PAYMENT` → `ACTIVE` | `REJECTED`

### API
| Method | Path | Notes |
|---|---|---|
| POST | `/campaigns` | create + reserve |
| GET | `/campaigns` | owner-scoped list |
| GET | `/campaigns/:id/metrics` | spend + event aggregates |
| PATCH | `/campaigns/:id/pause` | ownership required |
| PATCH | `/campaigns/:id/resume` | ownership required |
| POST | `/campaigns/rank` | auction ranking |
| POST | `/campaigns/webhook/chapa` | payment confirmation |


## Flag for the team: `ad_events` storage

**Decision needed before scale:** keep `ad_events` in Postgres (current MVP) vs move to a time-series / analytics store.

| Option | Pros | Cons |
|---|---|---|
| **Postgres only (Phase 1)** | Simple, transactional with campaigns, one migration path | Raw aggregation for dashboards slows as the table grows; vacuum/bloat risk |
| **Postgres + rollups** | Keep source-of-truth in PG; nightly/hourly aggregate tables for dashboards | Extra jobs; eventual consistency on reports |
| **TimescaleDB (PG extension)** | Hypertables + retention policies; still SQL | Ops change on hosted Postgres |
| **ClickHouse / similar** | Fast OLAP for dashboards at high QPS | Dual-write / sync complexity; another system to operate |

**Recommendation for the PR:** ship Postgres-only for Phase 1 with the composite index `(campaign_id, event_type, occurred_at)`, document the risk, and revisit when daily event volume or dashboard p95 latency crosses an agreed threshold. Prefer rollup tables before a full store migration unless write QPS demands it earlier.
