# Beleqet admin

The admin app, served at admin.beleqetjobs.com. It is a separate Next.js app from the website (`beleqet-jobs-nextjs/`), so an admin's session lives on its own address and nothing on the public site can read it. The website's `/admin` redirects here.

It uses the website's colours, dark mode and English/Amharic switch, and talks to the same API.

## Run it

```bash
cp .env.example .env.local   # point NEXT_PUBLIC_API_URL at your API
npm install
npm run dev                  # http://localhost:3000
```

Sign in with an `ADMIN` account. Accounts with two-step sign-in are asked for their code. Sign-up can't create admins; an existing admin makes them on the Users page, or `node create-admin.js` from the repo root creates one locally.

## Pages

| Page | What it's for |
|---|---|
| Dashboard | Headline numbers, what's waiting for review, sign-ups and revenue |
| Reported content | Dismiss a report or remove the content |
| Trade licences | Verify a company or reject with a reason the employer sees |
| Disputes | Read the conversation, then refund, release or split the escrow |
| Bank transfers | Check receipts; approving starts the plan paid for |
| Jobs and projects | Take down listings that break the rules (never re-opens anything) |
| Users | Search, change role, suspend, delete, or erase personal data |
| Contact messages | The website's contact form |
| Send a notification | In-app message to everyone, one role or chosen people |
| Plans / Subscriptions | Prices, limits, PayPal plan IDs; who's on which plan |
| Fraud alerts | Review alerts, record a decision, switch rules on and off |
| Audit log | Every change made through the API, with CSV export |
| Email log | Every email sent; failed ones can be sent again |

The API enforces the safety rules too (`src/modules/admin/admin-rules.ts`): admins can't demote, suspend or delete themselves, the last active admin can't be removed, and moderation only takes listings down.

## Tests

```bash
npm test          # unit tests: translations complete in both languages, helpers
npm run test:e2e  # browser tests against a running API
```

The browser tests need `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `API_URL` (default `http://127.0.0.1:4000/api/v1`). Set `PW_CHANNEL=chrome` to use an installed Chrome instead of downloading Chromium. They create and delete their own test accounts.
