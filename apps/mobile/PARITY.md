# Mobile app: parity with the website

Goal: the Android app does everything beleqetjobs.com does, for job seekers, freelancers and
employers, in English and Amharic. It ships once, after every phase below is done and tested.
Branch: `feat/mobile-parity`.

## Rules

- No business logic in the app: the API decides; the app shows what it says.
- Text comes from the website's `beleqet-jobs-nextjs/locales/{en,am}.json`; mobile-only text lives in
  `apps/mobile/locales/{en,am}.json` under `m.`. `npm run check:i18n` fails on a missing key.
- Errors go through `lib/api-error.ts` (`errorText`), the same rules as the website.
- Never show made-up data. A failed request shows an error with Retry.
- `android/` is generated from `app.json` on each EAS build (prebuild); don't commit it.

## Phases

- [x] 0. Fallback jobs and projects removed; build fixed
- [x] 1. Foundation: theme, i18n, errors, sign-in (email, register with code, reset, two-step, Google/LinkedIn), role tabs, app links
- [x] 2. Job seeker: search, detail, apply, saved, applications, interviews, profile & CV, Resume Brain, alerts, feed
- [x] 3. Freelancer: projects, bid, my bids, contracts, contract screen, wallet + withdraw
- [x] 4. Employer: overview, post/edit job, hiring, applicants, post project, projects + bids, contract (fund, approve, revise, dispute), plan & billing, bank transfer, company
- [x] 5. Shared: messages (live), notifications + push, settings (language, theme, channels, feed, two-step, delete account)
- [x] 6. Career tools: CV Maker (PDF), portfolio, forum, chat-to-text, tax calculator, pricing, contact (about/privacy open the website)
- [ ] 7. Release: test APK on phones, Firebase for push, Play listing, production build

## Server changes in the same branch

- `push_tokens` table, `POST/DELETE /users/push-tokens`, `PushService` (each in-app notification is also pushed).
- `POST /auth/app-exchange` + `app_challenge` on `/auth/google|linkedin`: provider sign-in for the app with a one-time code.

## Known gaps / decisions

- Push on Android needs Firebase (FCM): a `google-services.json` in `app.json` and the FCM V1 key uploaded to EAS.
- Portfolio: case studies and the gallery are edited on the website only (kept intact when saving from the phone).
- About and Privacy open the website pages (hard-coded English there; one source for legal text).
- Password reset finishes on the website (the emailed link opens the browser).
- PayPal is not offered in the app (waiting on USD prices).
