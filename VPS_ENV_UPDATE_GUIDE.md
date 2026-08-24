# VPS Environment Update Guide
## Applying Real OAuth & Payment Credentials to Production

**Server:** 178.105.7.221  
**Deploy path:** /srv/beleqet-staging  
**Date applied:** 2026-08-15

---

### Step 1 — SSH into the VPS

```bash
ssh root@178.105.7.221
```

---

### Step 2 — Navigate to deploy path and back up current env

```bash
cd /srv/beleqet-staging
cp .env.staging .env.staging.bak.$(date +%Y%m%d_%H%M%S)
```

---

### Step 3 — Update the following variables in `.env.staging`

Use `nano .env.staging` or `vim .env.staging`.

**OAuth — Google:**
```
GOOGLE_CLIENT_ID=<from CEO — see secure channel>
GOOGLE_CLIENT_SECRET=<from CEO — see secure channel>
GOOGLE_CALLBACK_URL=https://api.beleqetjobs.com/api/v1/auth/google/callback
```

**OAuth — LinkedIn:**
```
LINKEDIN_CLIENT_ID=<from CEO — see secure channel>
LINKEDIN_CLIENT_SECRET=<from CEO — see secure channel>
LINKEDIN_CALLBACK_URL=https://api.beleqetjobs.com/api/v1/auth/linkedin/callback
```

**Stripe (test/sandbox keys — swap for live keys at production launch):**
```
STRIPE_SECRET_KEY=<from CEO — see secure channel>
STRIPE_PUBLISHABLE_KEY=<from CEO — see secure channel>
```

> Generate the webhook secret after registering the endpoint in the Stripe dashboard:
> `STRIPE_WEBHOOK_SECRET=whsec_...`

**PayPal (sandbox):**
```
PAYPAL_CLIENT_ID=<from CEO — see secure channel>
PAYPAL_CLIENT_SECRET=<from CEO — see secure channel>
```

**Chapa (live/sandbox):**
```
CHAPA_SECRET_KEY=<from CEO — see secure channel>
CHAPA_PUBLIC_KEY=<from CEO — see secure channel>
CHAPA_ENCRYPTION_KEY=<from CEO — see secure channel>
CHAPA_WEBHOOK_SECRET=<generate: openssl rand -hex 32>
CHAPA_CALLBACK_URL=https://api.beleqetjobs.com/api/v1/escrow/callback
CHAPA_RETURN_URL=https://beleqetjobs.com/freelance/payment-success
```

**Correct the domain URLs:**
```
STAGING_APP_BASE_URL=https://api.beleqetjobs.com
STAGING_FRONTEND_URLS=https://admin.beleqetjobs.com,https://beleqetjobs.com
```

---

### Step 4 — Also update the NEXT_PUBLIC_SITE_URL in the Jobs frontend env

The `beleqet-jobs-nextjs` container reads this from its own env block in `docker-compose.staging.yml`.
Ensure it is set to:
```
NEXT_PUBLIC_SITE_URL=https://beleqetjobs.com
```

---

### Step 5 — Restart containers to pick up the new env

```bash
docker compose -f docker-compose.staging.yml down
docker compose -f docker-compose.staging.yml up -d
```

---

### Step 5b — Deploy the new homepage-frontend container (first time)

The `frontend-main` directory is now containerised as `beleqet2-homepage` on port 3002.
Run this after pulling the latest code:

```bash
cd /srv/beleqet-staging
git pull origin main
docker compose -f docker-compose.staging.yml build homepage-frontend
docker compose -f docker-compose.staging.yml up -d homepage-frontend
```

Nginx already routes `beleqetjobs.com /` to port 3002 — reload Nginx after updating the conf:

```bash
nginx -t && systemctl reload nginx
# or if Nginx is running in a container:
docker exec beleqet2-nginx nginx -s reload
```

---

### Step 5c — Register Stripe Webhook

In the Stripe Dashboard → Developers → Webhooks → Add endpoint:
- URL: `https://api.beleqetjobs.com/api/v1/payments/webhook/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`

Copy the generated `whsec_...` value and add it to `.env.staging`:
```
STRIPE_WEBHOOK_SECRET=whsec_...
```
Then restart the backend container.

---

### Step 6 — Verify OAuth works

1. Go to https://beleqetjobs.com/login
2. Click "Sign in with Google" → should redirect to Google consent, then back to the site
3. Click "Sign in with LinkedIn" → same flow
4. Stripe test payment → use card `4242 4242 4242 4242`, any future expiry, any CVC

---

### Notes

- Stripe **test** keys are currently in use (`sk_test_` / `pk_test_`). Replace with live keys only
  after going fully live and completing Stripe's account activation.
- PayPal is currently using **sandbox** mode. Switch to production credentials at launch.
- This file should NOT be committed to the repo. It is a local ops reference only.
