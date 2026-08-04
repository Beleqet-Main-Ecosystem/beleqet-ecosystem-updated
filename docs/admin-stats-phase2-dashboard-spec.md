# Admin Stats — Phase 2 Dashboard Specification

**Module:** Admin Stats (Admin & Control)  
**Depends on:** [Phase 1 Data Map](./admin-stats-phase1-data-map.md)  
**Date:** 2026-08-04  
**Rule:** No aggregation logic in this doc — only layout, metric definitions, and exact API contracts.

---

## 1. Dashboard layout (sketch)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  ADMIN STATS                                    [Date range] [Currency] [CSV] │
├──────────────────────────────────────────────────────────────────────────────┤
│  TOP ROW — Summary cards (6)                                                 │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────────┐ ┌──────────────┐ │
│  │ Total  │ │ Active │ │ Total  │ │ Active │ │ Revenue    │ │ MoM revenue  │ │
│  │ users  │ │ users  │ │projects│ │projects│ │ this month │ │ change %     │ │
│  │  N     │ │  N     │ │  N     │ │  N     │ │  ¤ amount  │ │  ±% / −%   │ │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────────┘ └──────────────┘ │
├──────────────────────────────────────────────────────────────────────────────┤
│  MIDDLE — Charts                                                             │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐│
│  │ Revenue (daily / weekly / monthly)  │  │ User growth                     ││
│  │ [7d] [30d] [12m]                    │  │ Registrations + Active (opt.)   ││
│  │ bar/line — missing dates = 0        │  │ [7d] [30d] [12m]                ││
│  └─────────────────────────────────────┘  └─────────────────────────────────┘│
├──────────────────────────────────────────────────────────────────────────────┤
│  BOTTOM — Project breakdown                                                  │
│  Status summary chips/row: DRAFT · OPEN · IN_PROGRESS · COMPLETED · …        │
│  ┌──────────────────────────────────────────────────────────────────────────┐│
│  │ Recent projects (10)                              [Download CSV]         ││
│  │ Title | Status | Owner first name | Created at                           ││
│  └──────────────────────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────────────────────┘
```

**Global chrome (all sections):**

| Control | Behavior |
| --- | --- |
| Date range | Presets `7d` \| `30d` \| `12m` **or** custom `from`/`to` (ISO date, inclusive calendar days in `Africa/Addis_Ababa` unless `tz` override) |
| Currency | ISO 4217, default `ETB`; all money fields returned in this currency |
| Download CSV | Per-table / per-series export endpoints (see §5) |

**Auth (every endpoint):** `JwtAuthGuard` + `Roles('ADMIN')` + `RequirePermissions('view:stats')`.

**Base path:** `/admin-stats`  
**Content-Type:** `application/json` except CSV exports (`text/csv`).

---

## 2. Metric dictionary (exact meanings)

“Projects” in this dashboard = **`FreelanceJob`** only (title, client owner, freelance statuses). Employment `Job` is out of scope for these cards/table unless a later revision adds a `scope=jobs|freelance|all` flag (default `freelance`).

### 2.1 Summary cards

| Card | Definition | Primary source | Notes |
| --- | --- | --- | --- |
| **Total users** | Count of all users all-time | `users` | Includes inactive; no date filter |
| **Active users (30d)** | Distinct users with ≥1 successful session in the last 30 days ending “now” | Prefer `users.lastLoginAt` once added; until then: distinct `refresh_tokens.userId` where `createdAt ≥ now-30d` | Date range filter does **not** change this card (always rolling 30d). Document `activeUsersBasis` in response |
| **Total projects** | Count of all freelance jobs all-time | `freelance_jobs` | No date filter |
| **Active projects** | Count where status ∉ (`COMPLETED`, `CANCELLED`) | `freelance_jobs` | Includes `DRAFT`, `FUNDED`, `OPEN`, `IN_PROGRESS` |
| **Total revenue this month** | Platform revenue in the calendar month of `to` (or “now” if no custom range) | Sum of fee sources below, FX → `currency` | See revenue composition |
| **Revenue change vs last month (%)** | `((thisMonth − lastMonth) / lastMonth) × 100` | Same composition | If `lastMonth === 0`: return `null` for `%` and `changeDirection: "flat"\|"up"\|"new"` |

**Revenue composition (platform income, not GMV):**

1. `escrow_transactions.platformFee` where `status = RELEASED` and recognition date = `releasedAt` (fallback `updatedAt` if null)  
2. `payments.amount` where `status = SUCCEEDED` (`createdAt`); subtract `REFUNDED` / `PARTIALLY_REFUNDED` amounts in period (`refundedAt` or status change date)  
3. `subscription_transactions.amount` where `status = SUCCEEDED` (`createdAt`)

All amounts converted via existing wallet FX to requested `currency`. Integer minor units in DB → API returns **decimal major units** as `number` (e.g. cents/santim ÷ 100) **or** keep integer minor units consistently — **choose integer minor units** to match the rest of the API (`amount` as `Int`). Document `amountUnit: "minor"`.

### 2.2 Revenue chart series

| Property | Rule |
| --- | --- |
| Metric | Daily (or monthly for `12m`) sum of platform revenue (same composition) |
| Buckets | `7d` / `30d`: one point per calendar day; `12m`: one point per calendar month |
| Gaps | Every bucket in the range **must** appear; missing days/months → `revenue: 0` |
| Custom range | If `from`/`to` span ≤ 45 days → daily; else → monthly |
| Order | Ascending by `date` |

### 2.3 User growth chart series

| Series | Rule |
| --- | --- |
| `registrations` | Count `users` with `createdAt` in bucket (required) |
| `activeUsers` | Distinct active users in bucket (optional until login tracking is solid) — same basis as summary card, bucketed | Gaps → `0` |

### 2.4 Project breakdown

**Status summary:** counts for every `FreelanceJobStatus` value (including zeros).

**Recent list:** 10 most recent by `createdAt DESC`:

| Column | Field |
| --- | --- |
| Name | `freelance_jobs.title` |
| Status | `status` |
| Owner first name | `client.firstName` only (no email / last name — GDPR-safe for dashboard) |
| Date | `createdAt` (ISO-8601) |

Optional filter: if global date range set, recent list is restricted to projects with `createdAt` in range (still max 10). Status summary remains **all-time** unless `applyRangeToProjects=true` query flag (default `false`).

---

## 3. Shared query parameters

Used by overview + chart endpoints (CSV uses the same where applicable):

| Param | Type | Required | Default | Description |
| --- | --- | --- | --- | --- |
| `currency` | string | no | `ETB` | ISO 4217 |
| `lang` | string | no | `en` | i18n for labels/messages |
| `range` | enum | no | `30d` | `7d` \| `30d` \| `12m` \| `custom` |
| `from` | date `YYYY-MM-DD` | if `custom` | — | Inclusive start |
| `to` | date `YYYY-MM-DD` | if `custom` | — | Inclusive end |
| `tz` | string | no | `Africa/Addis_Ababa` | Bucket timezone |
| `projectScope` | enum | no | `freelance` | Reserved: `freelance` only in v1 |

**Validation:**

- `from ≤ to`
- Max span: 366 days for daily series; reject otherwise with `400`
- `currency` must be supported by FX helper; else `400`

---

## 4. Endpoint contracts

All JSON responses wrap metadata:

```ts
{
  generatedAt: string;      // ISO now
  currency: string;
  amountUnit: "minor";
  range: { preset: string; from: string; to: string; tz: string };
}
```

### 4.1 Overview (summary cards)

`GET /admin-stats/overview`

**Query:** shared params (cards that are “this month / MoM” use calendar months relative to `to` / now; total users/projects ignore range).

**Response `200`:**

```json
{
  "generatedAt": "2026-08-04T13:00:00.000Z",
  "currency": "ETB",
  "amountUnit": "minor",
  "range": { "preset": "30d", "from": "2026-07-05", "to": "2026-08-04", "tz": "Africa/Addis_Ababa" },
  "cards": {
    "totalUsers": 12500,
    "activeUsers": {
      "count": 840,
      "windowDays": 30,
      "basis": "refresh_token"
    },
    "totalProjects": 3200,
    "activeProjects": 410,
    "revenueThisMonth": {
      "amount": 1250000,
      "month": "2026-08"
    },
    "revenueChangeVsLastMonth": {
      "thisMonthAmount": 1250000,
      "lastMonthAmount": 1000000,
      "percentChange": 25.0,
      "direction": "up"
    }
  }
}
```

`activeUsers.basis`: `"last_login"` \| `"refresh_token"` \| `"event_log"` (whichever implemented).  
`percentChange`: `number | null`.  
`direction`: `"up"` \| `"down"` \| `"flat"` \| `"new"` (`new` when last month was 0 and this month > 0).

**Errors:** `401`, `403`, `400` (invalid range/currency).

---

### 4.2 Revenue chart

`GET /admin-stats/charts/revenue`

**Query:** shared params. Chart period = resolved `from`/`to` from `range` (not “this month” only).

**Response `200`:**

```json
{
  "generatedAt": "2026-08-04T13:00:00.000Z",
  "currency": "ETB",
  "amountUnit": "minor",
  "range": { "preset": "30d", "from": "2026-07-05", "to": "2026-08-04", "tz": "Africa/Addis_Ababa" },
  "granularity": "day",
  "series": [
    { "date": "2026-07-05", "revenue": 0 },
    { "date": "2026-07-06", "revenue": 45000 },
    { "date": "2026-08-04", "revenue": 12000 }
  ],
  "totals": { "revenue": 980000 }
}
```

- `granularity`: `"day"` \| `"month"`  
- `series[].date`: day → `YYYY-MM-DD`; month → `YYYY-MM`  
- Length: exactly one entry per bucket in range (zeros filled)

---

### 4.3 User growth chart

`GET /admin-stats/charts/users`

**Query:** shared params.

**Response `200`:**

```json
{
  "generatedAt": "2026-08-04T13:00:00.000Z",
  "currency": "ETB",
  "amountUnit": "minor",
  "range": { "preset": "30d", "from": "2026-07-05", "to": "2026-08-04", "tz": "Africa/Addis_Ababa" },
  "granularity": "day",
  "series": [
    { "date": "2026-07-05", "registrations": 12, "activeUsers": 40 },
    { "date": "2026-07-06", "registrations": 0, "activeUsers": 38 }
  ],
  "totals": { "registrations": 210, "activeUsers": null },
  "activeUsersAvailable": true
}
```

- If active-over-time cannot be computed yet: set `activeUsersAvailable: false`, each `activeUsers: null`, and `totals.activeUsers: null` (registrations still required with zeros filled).

---

### 4.4 Project breakdown (status + recent table)

`GET /admin-stats/projects/breakdown`

**Query:** shared params + `recentLimit` (default `10`, max `50`) + `applyRangeToProjects` (boolean, default `false`).

**Response `200`:**

```json
{
  "generatedAt": "2026-08-04T13:00:00.000Z",
  "currency": "ETB",
  "amountUnit": "minor",
  "range": { "preset": "30d", "from": "2026-07-05", "to": "2026-08-04", "tz": "Africa/Addis_Ababa" },
  "statusSummary": [
    { "status": "DRAFT", "count": 40 },
    { "status": "FUNDED", "count": 12 },
    { "status": "OPEN", "count": 90 },
    { "status": "IN_PROGRESS", "count": 268 },
    { "status": "COMPLETED", "count": 2700 },
    { "status": "CANCELLED", "count": 90 }
  ],
  "recentProjects": [
    {
      "id": "uuid",
      "title": "Mobile app redesign",
      "status": "OPEN",
      "ownerFirstName": "Abebe",
      "createdAt": "2026-08-03T18:22:01.000Z"
    }
  ]
}
```

- `statusSummary` must include **all** enum values, even when `count` is 0.  
- `recentProjects.length` ≤ `recentLimit`.

---

### 4.5 Legacy dashboard (compat)

`GET /admin-stats/dashboard` (existing)

Keep during migration; document as **deprecated**. New UI must call §4.1–4.4. Optional: make it a thin aggregator calling the same service methods as overview.

---

## 5. CSV export endpoints

Every table/series has a download. Same auth + query filters as the JSON sibling.

| UI control | Method | Path | CSV columns |
| --- | --- | --- | --- |
| Overview cards | `GET` | `/admin-stats/overview/export.csv` | `metric,value,unit,month_or_window` |
| Revenue chart | `GET` | `/admin-stats/charts/revenue/export.csv` | `date,revenue,currency` |
| User growth | `GET` | `/admin-stats/charts/users/export.csv` | `date,registrations,active_users` |
| Status summary | `GET` | `/admin-stats/projects/status/export.csv` | `status,count` |
| Recent projects | `GET` | `/admin-stats/projects/recent/export.csv` | `id,title,status,owner_first_name,created_at` |

**Headers:**

```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="admin-stats-<resource>-<from>_<to>.csv"
```

**Rules:** UTF-8, header row required, RFC 4180 quoting, dates ISO, money in minor units (same as JSON), no PII beyond `owner_first_name`.

---

## 6. UI ↔ endpoint wiring

| UI region | Endpoint(s) |
| --- | --- |
| Top summary cards | `GET /admin-stats/overview` (+ export CSV) |
| Revenue chart + 7d/30d/12m toggle | `GET /admin-stats/charts/revenue` (+ export) |
| User growth chart | `GET /admin-stats/charts/users` (+ export) |
| Status summary row | from `GET /admin-stats/projects/breakdown` → `statusSummary` (+ status CSV) |
| Recent projects table | same breakdown → `recentProjects` (+ recent CSV) |
| Global date range / currency | query params on all of the above |

**Frontend load strategy:** parallel fetch overview + revenue + users + breakdown on mount / filter change. Charts re-fetch only when `range` / `currency` changes.

---

## 7. Non-functional requirements (contract-level)

| Concern | Requirement |
| --- | --- |
| Security | Admin + `view:stats` only; no API keys in responses; no emails/phones in payloads |
| GDPR | Aggregates + owner first name only on recent list |
| Performance | Target p95 < 1s for default 30d; allow DB indexes on `createdAt` / `releasedAt` / `status` in Phase 3 |
| Empty state | Cards `0`, series full zero-filled range, recent `[]` |
| i18n | `lang` may localize `message` / chart titles later; enum statuses stay English codes |

---

## 8. Phase 2 → Phase 3 handoff checklist

Before writing aggregation logic, implementers must:

1. Add or confirm **active-user basis** (`lastLoginAt` preferred — Phase 1 gap #1).  
2. Fix revenue to use **`platformFee` + payments + subscriptions** (Phase 1 gap #3).  
3. Implement zero-fill bucket helper for day/month series.  
4. Ship Jest unit tests per service method (quality gate).  
5. Deprecate flat `GET /admin-stats/dashboard` fields in favor of this contract.

---

## 9. Phase 2 verdict

| Deliverable | Status |
| --- | --- |
| Layout sketch (cards → charts → table) | Specified §1 |
| Six overview numbers | Specified §2.1 + §4.1 |
| Revenue chart (7d/30d/12m, zeros) | Specified §2.2 + §4.2 |
| User growth (+ optional active series) | Specified §2.3 + §4.3 |
| Project status + 10 recent | Specified §2.4 + §4.4 |
| Date filters + CSV per table | Specified §3 + §5 |
| Exact endpoint return shapes | Specified §4–§5 |

**Ready for Phase 3:** implement NestJS handlers/services against these contracts only.
