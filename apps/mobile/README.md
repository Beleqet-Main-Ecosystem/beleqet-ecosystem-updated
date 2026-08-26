# Beleqet Mobile App

React Native (Expo) mobile app for [Beleqet Jobs](https://beleqetjobs.com) — Ethiopia's Jobs & Freelance Marketplace.

---

## Project structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx            Root layout — auth guard + splash
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/
│   │   ├── _layout.tsx        Tab navigator (Jobs / Freelance / Chat / Profile)
│   │   ├── jobs.tsx
│   │   ├── freelance.tsx
│   │   ├── chat.tsx
│   │   └── profile.tsx
│   ├── job/[id].tsx           Job detail + apply
│   ├── gig/[id].tsx           Gig detail + proposal form
│   └── notifications.tsx
├── api/
│   ├── client.ts              Axios instance + JWT silent refresh
│   ├── auth.ts                login, register, fetchMe
│   ├── jobs.ts                fetchJobs, fetchJob, fetchCategories, applyToJob
│   └── freelance.ts           fetchGigs, fetchGig, submitProposal
├── store/
│   └── auth.store.ts          Zustand global auth state
├── components/
│   ├── JobCard.tsx
│   ├── GigCard.tsx
│   ├── CategoryPill.tsx
│   ├── EscrowBadge.tsx
│   └── ThemeProvider.tsx
├── assets/                    App icons + splash (see assets/README.txt)
├── app.json                   Expo config
├── eas.json                   EAS Build profiles
└── package.json
```

---

## Prerequisites

| Tool | Version |
|------|---------|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| Expo CLI | `npm i -g expo-cli` |
| EAS CLI | `npm i -g eas-cli` |
| Android Studio | For Android emulator |
| Xcode 15+ | For iOS simulator (macOS only) |

---

## Local development

```bash
cd apps/mobile

# 1. Install dependencies
npm install

# 2. Copy and fill in env
cp .env.example .env
# Edit .env — set EXPO_PUBLIC_API_URL to your backend

# 3. Start Metro bundler
npm start

# Press 'a' → Android emulator
# Press 'i' → iOS simulator (macOS only)
# Scan QR → Expo Go on physical device
```

---

## Environment variables

| Variable | Description |
|----------|-------------|
| `EXPO_PUBLIC_API_URL` | Backend API base URL (e.g. `https://api.beleqetjobs.com/api/v1`) |
| `EXPO_PUBLIC_SITE_URL` | Web site URL (e.g. `https://beleqetjobs.com`) |

---

## Building for stores

### Step 1 — EAS account setup (one-time)

```bash
# Login to your Expo account
eas login

# Link this project to EAS (updates extra.eas.projectId in app.json)
eas init
```

### Step 2 — Add assets

Place the following in `assets/` before building (see `assets/README.txt`):
- `icon.png` — 1024×1024
- `adaptive-icon.png` — 1024×1024 (Android foreground)
- `splash.png` — 1284×2778

### Step 3 — Build

```bash
# Android APK (internal testing)
npm run build:android -- --profile preview

# Android AAB (Play Store)
npm run build:android -- --profile production

# iOS (App Store — macOS or EAS cloud)
npm run build:ios -- --profile production

# Both platforms at once
npm run build:all
```

---

## Google Play Store

1. Create app at [play.google.com/console](https://play.google.com/console)
   - Package name: `com.beleqet.jobs`
2. Complete the store listing (description, screenshots, rating, privacy policy)
3. Set up a **Service Account** for automated submissions:
   - Play Console → Setup → API access → Create service account
   - Download JSON key → save as `apps/mobile/google-service-account.json`
4. Submit:
   ```bash
   npm run submit:android
   ```
   Or manually upload the `.aab` from EAS dashboard → Play Console → Production.

**Review time:** 3–7 days (first release), ~1–2 hours thereafter.

---

## Apple App Store

> Requires macOS + Xcode 15, or EAS cloud builds.

1. Enroll at [developer.apple.com](https://developer.apple.com) ($99/year)
2. Create app at [appstoreconnect.apple.com](https://appstoreconnect.apple.com)
   - Bundle ID: `com.beleqet.jobs`
3. Update `eas.json` → `submit.production.ios`:
   - `appleId` — your Apple Developer email
   - `ascAppId` — App Store Connect numeric App ID
   - `appleTeamId` — your team ID from developer.apple.com
4. Build + submit:
   ```bash
   npm run build:ios
   npm run submit:ios
   ```

**Review time:** 24–48 hours typically.

---

## GitHub Actions CI/CD (auto-publish on tag)

Create `.github/workflows/mobile-release.yml`:

```yaml
name: Mobile Release

on:
  push:
    tags:
      - 'mobile-v*'   # e.g. git tag mobile-v1.0.1 && git push --tags

jobs:
  build-submit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - uses: expo/expo-github-action@v8
        with:
          eas-version: latest
          token: ${{ secrets.EXPO_TOKEN }}
      - run: cd apps/mobile && npm ci
      - run: cd apps/mobile && eas build --platform all --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
      - run: cd apps/mobile && eas submit --platform all --profile production --non-interactive
        env:
          EXPO_TOKEN: ${{ secrets.EXPO_TOKEN }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_SPECIFIC_PASSWORD }}
```

**Required GitHub Secrets:**

| Secret | Where to get |
|--------|-------------|
| `EXPO_TOKEN` | expo.dev → Account Settings → Access Tokens |
| `APPLE_ID` | Your Apple Developer email |
| `APPLE_APP_SPECIFIC_PASSWORD` | appleid.apple.com → App-Specific Passwords |

---

## OTA updates (after publish)

Once live on stores, use EAS Update to push JS-only fixes without a new store build:

```bash
# Publish an update to production channel
eas update --branch production --message "Fix: job detail crash on missing salary"
```

Users receive the update silently on next app launch.

---

## API endpoints used

| Screen | Endpoint |
|--------|----------|
| Login | `POST /auth/login` |
| Register | `POST /auth/register` |
| Token refresh | `POST /auth/refresh` |
| My profile | `GET /auth/me` |
| Job feed | `GET /jobs?limit=40&category=...` |
| Job detail | `GET /jobs/:id` |
| Apply to job | `POST /jobs/:id/apply` |
| Categories | `GET /jobs/categories` |
| Gig feed | `GET /freelance/jobs?limit=40&status=OPEN` |
| Gig detail | `GET /freelance/jobs/:id` |
| Submit proposal | `POST /freelance/jobs/:id/proposals` |
| Transcribe audio | `POST /chat-to-text/transcribe` |

Base URL: `https://api.beleqetjobs.com/api/v1`

---

## Bundle IDs

| Platform | ID |
|----------|-----|
| Android (Google Play) | `com.beleqet.jobs` |
| iOS (App Store) | `com.beleqet.jobs` |
