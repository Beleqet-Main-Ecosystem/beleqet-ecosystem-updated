# Stripe Webhook Registration Guide

## Endpoint to register
```
https://api.beleqetjobs.com/api/v1/payments/webhook/stripe
```

## Steps

1. Go to https://dashboard.stripe.com/test/webhooks (test mode) or
   https://dashboard.stripe.com/webhooks (live mode).

2. Click **"Add endpoint"**.

3. Enter the endpoint URL above.

4. Under **"Select events to listen to"**, add these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `charge.refunded`
   - `customer.subscription.created`
   - `customer.subscription.deleted`
   - `customer.subscription.updated`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

5. Click **"Add endpoint"** to save.

6. On the webhook detail page, reveal the **Signing secret** — it starts with `whsec_`.

7. Copy that value and add it to `.env.staging` on the VPS:
   ```
   STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
   ```

8. Then restart the backend container:
   ```bash
   docker compose up -d --force-recreate backend
   ```

## Verify
Send a test event from the Stripe dashboard → the backend should log it and return HTTP 200.
