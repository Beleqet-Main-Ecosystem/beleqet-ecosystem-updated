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
CHAPA_RETURN_URL=https://beleqetpay.com/payment-success
```

> ⚠️ **beleqetpay.com domain switch (applied 2026-08-26)**
> `beleqetpay.com` is now registered via Yegara Host and DNS is delegated to Cloudflare,
> pointing A/CNAME records (`@` and `www`) at `178.105.7.221`.
> The Chapa return URL above already reflects the new domain.

**Correct the domain URLs (include beleqetpay.com in CORS origins):**
```
STAGING_APP_BASE_URL=https://api.beleqetjobs.com
STAGING_FRONTEND_URLS=https://admin.beleqetjobs.com,https://beleqetjobs.com,https://beleqetpay.com
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

---

## beleqetpay.com Domain Switch Runbook (2026-08-26)

**Domain:** `beleqetpay.com`  
**Registrar:** Yegara Host  
**DNS:** Cloudflare (nameservers delegated from Yegara Host)  
**Server IP:** `178.105.7.221`

### DNS Records (already configured in Cloudflare)

| Type  | Name | Value          | Proxy  |
|-------|------|----------------|--------|
| A     | @    | 178.105.7.221  | ✅ On  |
| A     | www  | 178.105.7.221  | ✅ On  |

DNS is currently propagating (allow up to 48 h for full global TTL expiry).

---

### Step A — Add Nginx vhost for beleqetpay.com

SSH into the VPS and add (or update) the Nginx config:

```bash
ssh root@178.105.7.221
nano /etc/nginx/sites-available/beleqetpay.com
```

Minimum config — proxies payment routes to the backend and serves the jobs frontend for the
payment success/cancel pages:

```nginx
server {
    listen 80;
    server_name beleqetpay.com www.beleqetpay.com;

    # Redirect HTTP → HTTPS (let Cloudflare handle SSL, set mode to "Full")
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name beleqetpay.com www.beleqetpay.com;

    # If terminating SSL locally (not relying solely on Cloudflare):
    # ssl_certificate     /etc/letsencrypt/live/beleqetpay.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/beleqetpay.com/privkey.pem;

    # Proxy all payment/webhook API calls to the NestJS backend
    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Serve payment success/cancel pages from the Next.js jobs frontend
    location /payment- {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    # Default — serve the jobs frontend
    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

Enable and reload:

```bash
ln -sf /etc/nginx/sites-available/beleqetpay.com /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

---

### Step B — Update .env.staging on the VPS

```bash
cd /srv/beleqet-staging
nano .env.staging
```

Change these two lines:

```env
STAGING_FRONTEND_URLS=https://admin.beleqetjobs.com,https://beleqetjobs.com,https://beleqetpay.com
CHAPA_RETURN_URL=https://beleqetpay.com/payment-success
```

---

### Step C — Restart containers

```bash
docker compose -f docker-compose.staging.yml restart backend
```

No rebuild is needed — only the env vars changed.

---

### Step D — Register beleqetpay.com webhooks in payment dashboards

**Chapa Dashboard** (dashboard.chapa.co → Webhooks):
- Webhook URL: `https://api.beleqetjobs.com/api/v1/webhooks/chapa`
- (The backend webhook endpoint is domain-agnostic — no code change needed)

**Stripe Dashboard** (dashboard.stripe.com → Developers → Webhooks):
- Endpoint URL: `https://api.beleqetjobs.com/api/v1/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `checkout.session.completed`

---

### Step E — SSL Certificate (if not relying on Cloudflare SSL)

If you need a local cert (Cloudflare SSL mode set to "Full (strict)"):

```bash
certbot --nginx -d beleqetpay.com -d www.beleqetpay.com
```

---

### Step F — Verify

1. `curl -I https://beleqetpay.com` → should return `200` or `301`
2. Chapa test payment → confirm return lands on `https://beleqetpay.com/payment-success`
3. Backend CORS test: `curl -H "Origin: https://beleqetpay.com" https://api.beleqetjobs.com/api/v1/health/ready` → no CORS error in response headers

---

### Mobile App — Developer Note

The Expo mobile app should use the following production env vars in its EAS build secrets:

```env
EXPO_PUBLIC_API_URL=https://api.beleqetjobs.com/api/v1
EXPO_PUBLIC_SITE_URL=https://beleqetjobs.com
EXPO_PUBLIC_PAYMENT_RETURN_URL=https://beleqetpay.com/payment-success
```

The in-app WebView payment flow should redirect to `EXPO_PUBLIC_PAYMENT_RETURN_URL` after Chapa
processes the payment.
