# Campaigns — Production Readiness Notes

## Exception handling

`AllExceptionsFilter` is registered globally in `src/main.ts` via
`app.useGlobalFilters(...)`. The campaigns module throws standard Nest
`HttpException` subclasses only (`BadRequestException`, `ForbiddenException`,
`NotFoundException`, `ConflictException`, `UnauthorizedException` on webhook
signature failure). Those are caught and formatted like every other module
(structured JSON + i18n error codes; stack traces withheld in production).

No module-specific exception filter is required.

## Environment variables (campaigns)

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | yes | Prisma / campaigns tables |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` / `REDIS_TLS` | yes | Ranking cache TTL + cron pod locks |
| `CHAPA_SECRET_KEY` | yes (payments) | ChapaClient initialize/verify |
| `CHAPA_WEBHOOK_SECRET` | yes (webhooks) | HMAC verify on `POST /campaigns/webhook/chapa` |
| `CHAPA_CAMPAIGN_CALLBACK_URL` | recommended | Checkout callback → campaigns webhook |
| `CHAPA_RETURN_URL` | optional | Post-checkout browser redirect |
| `CHAPA_BASE_URL` | optional | Defaults to `https://api.chapa.co/v1` |
| FX API key | **none** | `WalletService` uses `open.er-api.com` (no key) |

## Multi-currency

At budget reservation, `WalletService.getExchangeRate(from, to)` is stored on
the campaign as `fxRate` / `fxFromCurrency` / `fxToCurrency`. Spend and budgets
remain in `currencyCode` minor units; wallet locks use the ETB conversion at
the snapshotted rate.

## Budget concurrency

`CampaignBudgetService.chargeBillableEvent` runs inside `$transaction` with:

1. `SELECT id FROM campaigns WHERE id = $1 FOR UPDATE` (row lock)
2. In-memory remaining-budget checks
3. Optimistic `updateMany` matching prior `spentAmount` / `dailySpent` / `ACTIVE`
4. Append-only `ad_events` insert

Two concurrent clicks that each fit the remaining cap but together would
exceed it: the second transaction blocks on `FOR UPDATE`, then either fails
the fit check or loses the `updateMany` race (`ConflictException`).

## Migrations

1. `20260802120000_add_campaigns_and_ad_events`
2. `20260802140000_campaigns_phase2_budget_payment`

## Docker

```bash
docker compose build backend
# or full stack:
docker compose up -d --build
```

**Local verification (this environment):**

- `npm run build` (Nest) — **passed**
- `docker compose build backend` — **passed** (image `beleqet-ecosystem-updated-backend:latest`)
- First attempt can fail if the builder cannot reach `binaries.prisma.sh`; retry when network is available.

## Test coverage (campaigns module)

Measured with:

```bash
npx jest --testPathPattern='modules/campaigns' --coverage \
  --collectCoverageFrom='modules/campaigns/**/*.ts' \
  --coveragePathIgnorePatterns='\\.spec\\.ts$'
```

| Scope | Stmts | Branch | Funcs | Lines |
|---|---|---|---|---|
| **All campaigns files** | 32.7% | 20.3% | 29.8% | 32.3% |
| `promotion-merge.util.ts` | 87.5% | 66.7% | 100% | 100% |
| `campaign-payment.service.ts` | 47.1% | 22.6% | 66.7% | 47.0% |
| `campaigns.service.ts` | 44.4% | 19.2% | 40% | 45.6% |
| `campaign-budget.service.ts` | 39.3% | 20% | 22.2% | 37.5% |
| `campaign-auction.service.ts` | 40% | 10.5% | 36.4% | 38.1% |

**16 tests passing** across 4 suites (unit + webhook + promotion merge integration).
Controller / scheduler / DTOs are intentionally thin and lightly covered; critical
paths (status transitions, concurrency helpers, webhook activation, ranking
tie-breaks) are exercised.
