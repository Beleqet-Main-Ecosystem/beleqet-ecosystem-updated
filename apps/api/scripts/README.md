# API scripts

Run from `apps/api/`.

| Path | What it is | Used by |
|---|---|---|
| `post-build.js` | Runs after `nest build` | `npm run build` |
| `seed-rbac.js` | Creates the admin, employer and freelancer role permissions | CI, fresh servers |
| `transcribe-with-faster-whisper.py` | Speech-to-text worker | The chat-to-text module, at runtime (it's in the image) |
| `dev/create-admin.js` | Creates `admin@beleqet.com` in a **local or test** database. Its password is in the file, so never run it against production | CI (Playwright), local setup |
| `dev/verify-2fa.js` | Walks through two-step sign-in against a local API | By hand |
| `dev/benchmark.js` | Compares REST and GraphQL response times on a local API | By hand |
| `dev/chapa/webhook-server.js` | Local server that receives Chapa test webhooks and creates checkout links | By hand, with Chapa **test** keys |
| `dev/chapa/simulate.js` | Sends a sample Chapa webhook to that server | By hand |
| `wordpress-migration/` | The one-time move of WordPress users into Beleqet (August 2026), kept for reference | — |

`dev/` and `wordpress-migration/` are left out of the Docker image (`.dockerignore`).
