# PR draft — Promoted / Boost Campaigns Engine

> Not submitted yet. Use when ready to open against `beleqet-ecosystem-updated`.

## Summary

- Adds the **Promoted Engine** end-to-end: Prisma `campaigns` + `ad_events`, Nest auction/budget/payment services, Chapa wallet reservation + webhook activation, Next.js Boost modal + analytics dashboard, GDPR retention/erasure, and search/feed boost injection.
- Multi-currency budgets snapshot FX at reservation write time (`fxRate` / `fxFromCurrency` / `fxToCurrency`) via `WalletService` + `open.er-api.com` (no API key).
- Budget deduction uses `SELECT … FOR UPDATE` + conditional `updateMany` so concurrent billable events cannot overspend daily/total caps.

## Migrations

1. `prisma/migrations/20260802120000_add_campaigns_and_ad_events`
2. `prisma/migrations/20260802140000_campaigns_phase2_budget_payment` (`PENDING_PAYMENT`, `dailySpent`, FX + reservation fields)

## Architecture (short)

| Layer | Pieces |
|---|---|
| Data | `Campaign`, `AdEvent` (append-only); polymorphic `targetType`/`targetId` |
| Auction | `score = bidAmount * qualityScore`; quality reuses AI-feed relevance; 45s Redis cache; newer campaign wins ties |
| Budget | CPC→click / CPM→impression; row lock + optimistic claim; midnight daily reset cron |
| Payments | Employer wallet lock + optional Chapa; webhook → `ACTIVE` / `REJECTED` |
| API | `POST/GET /campaigns`, pause/resume, metrics, rank, Chapa webhook |
| FE | Boost modal, `/employer/campaigns` analytics, i18n en/am |
| GDPR | Hashed IP/UA only; 90-day purge cron; erasure deletes events + completes campaigns |

## Concurrency / locking (reviewer focus)

`CampaignBudgetService.chargeBillableEvent`:

1. `$transaction`
2. `SELECT id FROM "campaigns" WHERE id = $1 FOR UPDATE`
3. Fit check against `totalBudget` / `dailyBudgetCap`
4. `updateMany` where `status=ACTIVE` and spend counters unchanged
5. Insert `ad_event`

Edge case covered in tests: two clicks that individually fit remaining daily headroom but together exceed it → only one succeeds.

## Exception handling

Campaigns throw Nest `HttpException` subclasses only; global `AllExceptionsFilter` in `main.ts` formats them consistently with the rest of the app.

## Env audit

See `.env.example` (Campaigns / Boost section) and `docs/campaigns-production-readiness.md`.

Key: `CHAPA_*`, `REDIS_*`, `DATABASE_URL`. FX provider needs **no** API key.

## Test plan

- [ ] `npx jest --testPathPattern='modules/campaigns'` — 16 tests green
- [ ] `docker compose build backend` succeeds
- [ ] `npx prisma migrate deploy` on clean DB
- [ ] Create campaign with wallet funds → `ACTIVE`
- [ ] Create campaign needing Chapa → `PENDING_PAYMENT` → webhook → `ACTIVE`
- [ ] Concurrent charge simulation / unit race test
- [ ] Search `GET /jobs?q=…` shows `promoted` boosts first
- [ ] Employer Boost modal + `/employer/campaigns` metrics UI

## Test coverage numbers

Campaigns module (see `docs/campaigns-production-readiness.md`): **~33% lines** overall; critical helpers higher (`promotion-merge` 100% lines). **16/16** tests passing.
