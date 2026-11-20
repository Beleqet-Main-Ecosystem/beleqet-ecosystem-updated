# API modules

Each module lives in the area it belongs to: `src/modules/<area>/<module>`. A module may use another
area's modules; the areas only make it easy to find things. `AppModule` (`src/app.module.ts`) loads
every module except the ones in `unfinished/`.

| Area | Modules |
|---|---|
| `accounts` | `auth` (sign-in, Google/LinkedIn/Telegram), `users`, `two-factor`, `rbac` (roles and permissions), `gdpr-guard` (data export and erasure) |
| `jobs` | `jobs`, `applications`, `screening` (scores applicants), `job-alerts`, `ai-feed`, `graphql-turbo` (the jobs GraphQL API), `resume-brain` (CV parsing), `salary`, `interview-planner`, `tax-calculator` |
| `freelance` | `freelance` (gigs, bids, contracts), `dispute-manager` |
| `payments` | `chapa`, `payments` (PayPal, Stripe), `manual-payment` (bank transfer receipts), `plans`, `subscriptions`, `billing` (provider events into subscriptions), `escrow` (BeleqetSafe), `wallet`, `beleqet-pay` (client for Beleqet Pay, not used yet) |
| `messaging` | `notifications`, `push`, `email-automation`, `telegram`, `chat`, `chat-to-text` (voice assistant), `community-forum`, `contact` |
| `admin` | `admin`, `admin-stats`, `reports`, `fraud-alert` (the admin's Fraud alerts page; loaded by `AdminModule`) with `anomaly-sensor` and `plagiarism` |
| `platform` | `audit` (the audit trail), `analytics`, `health`, `queues`, `redis`, `scheduler`, `uploads` (file storage) |
| `unfinished` | Server code only, switched off until finished: see [`unfinished/README.md`](unfinished/README.md) |

Imports between modules are relative (`../../payments/wallet/wallet.service`); `@modules/<area>/<module>/…`
works too.
