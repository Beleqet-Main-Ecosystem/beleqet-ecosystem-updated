# Deployment Checklist — Global Payment Gateway & DB Index Master

**PR:** feat/kalkidan-dagnu → main  
**Date:** 2026-07-06  
**Author:** Kalkidan Dagnu  
**Reviewer sign-off required before merge**

---

## 1. Pre-Deployment: Code & Tests

| # | Check | Status  |
|---|-------|-------- |
| 1.1 | All Jest unit tests pass (`npm test`) | ✅ |
| 1.2 | Integration tests pass (`payments-wallet.integration.spec.ts`) | ✅ |
| 1.3 | Test coverage ≥ 80 % for `payments/` and `db-index-master/` | ✅ |
| 1.4 | No TypeScript compile errors (`npm run build`) | ✅ |
| 1.5 | ESLint passes with no errors (`npm run lint`) | ✅ |
| 1.6 | `dist/` directory is **not** committed (confirmed in `.gitignore`) | ✅ |
| 1.7 | PR diff reviewed and approved by at least one team member | ☐ |

---

## 2. Environment Variables

All variables below must be set in the production environment **before** deployment.  
Use AWS Secrets Manager or the platform's secret store — **never commit real values**.

### 2.1 Stripe (Global-Payments-001)

| Variable | Description | Required |
|----------|-------------|----------|
| `STRIPE_SECRET_KEY` | Live secret key (`sk_live_…`) | ✅ |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret (`whsec_…`) | ✅ |

### 2.2 PayPal (Global-Payments-002)

| Variable | Description | Required |
|----------|-------------|----------|
| `PAYPAL_CLIENT_ID` | Live app client ID | ✅ |
| `PAYPAL_CLIENT_SECRET` | Live app client secret | ✅ |
| `PAYPAL_MODE` | Must be `live` in production (not `sandbox`) | ✅ |
| `PAYPAL_WEBHOOK_ID` | Webhook ID from PayPal dashboard | ✅ |
| `PAYPAL_RETURN_URL` | Redirect URL after payer approval | ✅ |
| `PAYPAL_CANCEL_URL` | Redirect URL if payer cancels | ✅ |

### 2.3 Wallet / Chapa

| Variable | Description | Required |
|----------|-------------|----------|
| `CHAPA_SECRET_KEY` | Chapa live secret key | ✅ |

### 2.4 Verification steps

- [ ] Confirm `PAYPAL_MODE=live` (not `sandbox`) in production config
- [ ] Confirm `STRIPE_SECRET_KEY` starts with `sk_live_`, not `sk_test_`
- [ ] Confirm `CHAPA_SECRET_KEY` is the live key
- [ ] Rotate all keys in staging before applying to production

> **Dev note (Kalkidan Dagnu, 2026-07-06):** All env vars are enumerated and documented above.
> `.env.example` in the repository contains placeholder values only — no secrets committed.

---

## 3. Database Migration

| # | Check | Status |
|---|-------|--------|
| 3.1 | Migration `20260706000001_global_payment_gateway` reviewed | ✅ |
| 3.2 | Migration is non-destructive (no `DROP TABLE`, no column removals) | ✅ |
| 3.3 | `prisma migrate deploy` run against a **staging** DB first | ☐ |
| 3.4 | Staging DB post-migration smoke test passed | ☐ |
| 3.5 | Production DB backup taken **before** running migration | ☐ |
| 3.6 | `prisma migrate deploy` run against production DB | ☐ |
| 3.7 | `prisma generate` output committed / regenerated in CI | ✅ |

---

## 4. Webhook Registration

### 4.1 Stripe

- [ ] Stripe Dashboard → Developers → Webhooks → Add endpoint
  - URL: `https://api.beleqet.com/payments/stripe/webhook`
  - Events to listen: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- [ ] Copy the generated signing secret into `STRIPE_WEBHOOK_SECRET`
- [ ] Test event delivery from the Stripe dashboard

### 4.2 PayPal

- [ ] PayPal Developer Dashboard → My Apps → Webhooks → Add webhook
  - URL: `https://api.beleqet.com/payments/paypal/webhook`
  - Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `BILLING.SUBSCRIPTION.ACTIVATED`, `BILLING.SUBSCRIPTION.CANCELLED`
- [ ] Copy the Webhook ID into `PAYPAL_WEBHOOK_ID`
- [ ] Send a test notification from the PayPal dashboard and confirm 200 response

---

## 5. Security Checklist

| # | Check | Status |
|---|-------|--------|
| 5.1 | Stripe webhook endpoint validates signature before processing | ✅ |
| 5.2 | PayPal webhook endpoint validates event before processing | ✅ |
| 5.3 | `AllExceptionsFilter` is globally registered (no raw stack traces in responses) | ✅ |
| 5.4 | PII fields (`email`, `phone`, `token`) stripped from Stripe metadata | ✅ |
| 5.5 | DB Index Master endpoints require `ADMIN` role (JWT guard confirmed) | ✅ |
| 5.6 | Helmet headers enabled in `main.ts` | ✅ |
| 5.7 | CORS restricted to known frontend origins | ✅ |
| 5.8 | Rate limiting enabled on payment and webhook routes | ✅ |
| 5.9 | No secrets in logs (check `AllExceptionsFilter` redaction) | ✅ |

> **Code review notes (2026-07-06):**
> - 5.1 ✅ `StripeService.handleWebhook` calls `stripe.webhooks.constructEvent` and throws `UnprocessableEntityException` on failure — verified in unit tests.
> - 5.2 ✅ `PaypalService.handleWebhook` calls `paypal.notification.webhookEvent.verify` when `PAYPAL_WEBHOOK_ID` is set — verified in unit tests.
> - 5.3 ✅ `AllExceptionsFilter` registered globally in `main.ts` via `app.useGlobalFilters(new AllExceptionsFilter(...))`.
> - 5.4 ✅ `StripeService.sanitiseMetadata` strips `email`, `phone`, `name`, `address`, `telegramId` keys — covered by unit tests.
> - 5.5 ✅ `DbIndexMasterController` decorated with `@UseGuards(JwtAuthGuard, RolesGuard)` and `@Roles('ADMIN')`.
> - 5.6 ✅ `helmet()` applied in `main.ts`.
> - 5.7 ✅ `app.enableCors({ origin: ... })` configured in `main.ts`.
> - 5.8 ✅ `ThrottlerGuard` applied globally via `ThrottlerModule.forRoot` in `app.module.ts`.
> - 5.9 ✅ `AllExceptionsFilter` redacts stack traces; `StripeService.handleStripeError` logs internally, never exposes raw Stripe messages.

---

## 6. Smoke Tests (Post-Deploy)

Run these against the production/staging environment after deployment:

### 6.1 Stripe

```bash
# Create a payment intent (test card)
curl -X POST https://api.beleqet.com/payments/stripe/intent \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 100, "currency": "USD"}'
# Expected: 201 with { id, clientSecret, status }
```

### 6.2 PayPal

```bash
# Create a PayPal order
curl -X POST https://api.beleqet.com/payments/paypal/order \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{"amount": 10, "currency": "USD"}'
# Expected: 201 with { id, approvalUrl, status }
```

### 6.3 DB Index Master

```bash
# Full report (admin only)
curl -X GET https://api.beleqet.com/admin/db-index/report \
  -H "Authorization: Bearer <ADMIN_JWT>"
# Expected: 200 with { totalIndexes, unusedIndexCount, suggestions, ... }

# EXPLAIN query
curl -X POST https://api.beleqet.com/admin/db-index/explain \
  -H "Authorization: Bearer <ADMIN_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT id FROM jobs WHERE status = $1"}'
# Expected: 200 with { plan, summary }
```

### 6.4 Wallet currency conversion

```bash
# Verify the /payments/stripe/currencies endpoint lists ETB
curl https://api.beleqet.com/payments/stripe/currencies \
  -H "Authorization: Bearer <JWT>"
# Expected: 200 with array containing { code: "ETB", ... }
```

---

## 7. Monitoring & Alerting

- [ ] Confirm error rate alert is configured for `POST /payments/**` (threshold: > 1 % 5xx in 5 min)
- [ ] Confirm latency alert for payment endpoints (threshold: p99 > 3 s)
- [ ] Stripe Dashboard → monitor failed payment intents
- [ ] PayPal Dashboard → monitor failed captures
- [ ] Application logs shipped to centralised log store (CloudWatch / ELK)

---

## 8. Rollback Plan

If critical issues arise post-deployment:

1. **Immediate:** Set feature flag / disable payment routes at the load balancer level.
2. **Database:** Run `prisma migrate resolve --rolled-back 20260706000001_global_payment_gateway` if migration must be reversed. _(Confirm this is safe — migration should be additive only.)_
3. **Code:** Revert the merge commit and redeploy the previous release tag.
4. **Webhooks:** Disable the new webhook endpoints in Stripe and PayPal dashboards to prevent duplicate processing.

---

## 9. Sign-Off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Author | Kalkidan Dagnu | | |
| Reviewer | | | |
| DevOps | | | |

> **Deployment is blocked until all ☐ items above are checked ✅ and all sign-offs are obtained.**
