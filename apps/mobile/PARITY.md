# Mobile app: parity with the website

Goal: the Android app does everything beleqetjobs.com does, for job seekers, freelancers and
employers, in English and Amharic. It ships once, after every phase below is done and tested.
Branch: `feat/mobile-parity`. Tick items as they land.

## Rules

- No business logic in the app: the API decides; the app shows what it says.
- Text comes from the website's `beleqet-jobs-nextjs/locales/{en,am}.json`; mobile-only text lives in
  `apps/mobile/locales/{en,am}.json` and overrides it.
- Errors go through `lib/api-error.ts` (`errorText`), the same rules as the website.
- Never show made-up data. A failed request shows an error with Retry.

## Phases

- [ ] 0. Hotfix: remove fallback jobs and projects; fix the type error
- [ ] 1. Foundation: theme, i18n, errors, auth (email, register with code, reset, 2FA, Google), role tabs, app links
- [ ] 2. Job seeker: search, detail, apply, saved, applications, interviews, profile & CV, Resume Brain, alerts, feed
- [ ] 3. Freelancer: projects, bid, my bids, contracts, contract screen, wallet + withdraw
- [ ] 4. Employer: overview, post/edit job, my jobs, applicants, post project, projects + bids, contract (fund, approve, revise, dispute), plan & billing, company
- [ ] 5. Shared: messages (live), notifications + push, settings (language, theme, 2FA, Telegram, delete account)
- [ ] 6. Career tools: CV Maker, portfolio, forum, chat-to-text, tax calculator, pricing/about/contact/privacy
- [ ] 7. Release: crash reporting, preview APK, store listing

## Notes

