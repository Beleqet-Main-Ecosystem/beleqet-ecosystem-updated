# scripts

Run everything from the repository root. Anything else you put in `scripts/` is ignored by git
(see `.gitignore`), so local one-off tools don't end up in the repository.

| Path | What it is | Used by |
|---|---|---|
| `ci/` | Helpers for the CI workflow: test environment, compose checks | `.github/workflows/ci.yml` |
| `deploy/` | Production deploy, migrations and server helpers | `.github/workflows/deploy-production.yml` |
| `post-build.js` | Runs after `nest build` | `npm run build` |
| `seed-rbac.js` | Creates the admin, employer and freelancer role permissions | CI, fresh servers |
| `transcribe-with-faster-whisper.py` | Speech-to-text worker | The API's chat-to-text module, at runtime |
| `dev/create-admin.js` | Creates `admin@beleqet.com` in a **local or test** database. Its password is in the file, so never run it against production | CI (Playwright), local setup |
| `dev/verify-2fa.js` | Walks through two-step sign-in against a local API | By hand |
| `dev/benchmark.js` | Compares REST and GraphQL response times on a local API | By hand |
| `dev/generate-mobile-assets.js` | Generates the Android app's icon, splash and notification images into `apps/mobile/assets` | By hand |
| `dev/chapa/webhook-server.js` | Local server that receives Chapa test webhooks and creates checkout links | By hand, with Chapa **test** keys |
| `dev/chapa/simulate.js` | Sends a sample Chapa webhook to that server | By hand |
| `wordpress-migration/` | The one-time move of WordPress users into Beleqet (August 2026), kept for reference | — |
