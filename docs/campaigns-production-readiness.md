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
