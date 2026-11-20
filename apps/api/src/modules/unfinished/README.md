# Unfinished modules (switched off)

These modules have their server code (and its tests) but **no screen** in the website, the admin
site or the mobile app, and nothing in production used them. They are kept so each can be finished
later; until then **none of them is loaded**: `AppModule` doesn't import them, so their endpoints
don't exist and their background work doesn't run. Their unit tests still run in CI.

| Module | What it is for | What exists | Missing before it can be switched on |
|---|---|---|---|
| `anomaly-sensor` | Spot multiple accounts and IP hopping; feeds `fraud-alert` | Event listeners and rules | Goes with `fraud-alert` |
| `db-index-master` | Database index and slow-query tool for admins | 5 admin endpoints | An admin screen |
| `encrypted-inbox` | End-to-end encrypted messages between employers and freelancers | 14 endpoints, encryption | Screens; today's chat uses the `chat` module |
| `faq-bot` | AI assistant answering questions about the platform | 6 endpoints, OpenAI | A chat widget, the knowledge base (empty) |
| `fraud-alert` | Alerts on suspicious activity (fast withdrawals, fake profiles), and rules | Rules engine, `/admin/fraud/...` endpoints | An admin screen; with `anomaly-sensor` and `plagiarism` |
| `kyc` | Check national ID, passport and trade licence documents | 5 endpoints, OpenAI document reading | Upload and review screens |
| `matching` | Match candidates' skills to jobs | 1 endpoint, a simple heuristic | A real matching model, a screen |
| `plagiarism` | Detect copied proposals and portfolios; used by `fraud-alert` | Similarity and internet checks | An internet search provider (`EXA_API_KEY` / `SEARCH_PROVIDER`) |
| `promoted-engine` | Paid featured job listings and campaign budgets | 7 endpoints | Screens, payment for campaigns |
| `review` | Star ratings and reviews after a freelance project | 6 endpoints | Screens on the freelance pages |
| `search` | A search engine for jobs (planned OpenSearch) | A stub | Everything; search works in the `jobs` module today |
| `smart-bidding` | AI-suggested bid prices for freelancers | 3 endpoints | Screens; it was never switched on |
| `smart-skill-tester` | Skill quizzes and verified skill badges | 2 endpoints | Questions (none written), screens |
| `user-preferences` | Theme and language stored on the server | 2 endpoints | A screen; the website keeps these in the browser today |
| `video-interview` | Recorded video interviews with transcription | 5 endpoints | File storage (`AWS_*` / `R2_*`), screens |
| `webhooks` | Send events to employers' hiring systems | Delivery and retries | Screens; it was never switched on. Its payment handlers duplicate the ones in `payments` and `escrow` |

**Switching one on:** move it to its area (for example `review` to `modules/freelance/`), import it in
`AppModule` (or, for `fraud-alert`, in the admin area's `AdminModule`), build its screens, and set the
settings it needs. Check its database tables: they exist but have never held data.
