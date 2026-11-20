# Beleqet Jobs — Next.js Frontend

Next.js 14 (App Router) frontend for the Beleqet Jobs platform, built from the
design system in `Beleqet_Design_Process_Pro.pdf` (colors, typography, layout) and the live
beleqet.com/vacancy reference.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

Live deployment: https://beleqet-interview-task-mu.vercel.app

## Stack

- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** — design tokens (colors, type scale) wired up in `tailwind.config.ts` and
  `app/globals.css`, matching the PDF's color system (`brandGreen #00653B`, etc.)
- **lucide-react** for icons

## Project structure

```
app/                  Routes only: each folder is a page (page.tsx, layout.tsx, loading.tsx)
  tg/                 The Telegram Mini App pages
features/<feature>/   Everything one feature needs: its components, hooks, API calls, types;
                      tests in features/<feature>/__tests__/ (jobs, freelance, dashboard,
                      portfolio, chat, forum, resume-brain, miniapp, ...)
components/           Shared by many pages: Header, Footer, AuthProvider, mobile/ navigation, ui/
lib/                  Shared helpers: api.ts, auth.ts, i18n.tsx, seo/, telegram/ (Mini App helpers and hooks)
locales/{en,am}.json  All website text, one section per area (read with useTranslation)
```

A page imports from its feature with `@/features/<feature>/...`; inside a feature, files import each
other relatively. Tests sit in a `__tests__/` folder next to the code they test.

## Data & auth (live backend)

Job, category, and detail data are fetched **live** from the NestJS API and validated with **zod**:

- `lib/api.ts` — `fetchJobs` / `fetchJob` / `fetchCategories`, consumed in Server Components
  (`app/page.tsx`, `app/jobs/page.tsx`, `app/jobs/[id]/page.tsx`) with ISR caching (`revalidate`).
- `lib/auth.ts` + `components/AuthProvider.tsx` — register/login, JWT persistence, and an
  auth-aware header.
- Job cards use context-specific dark/light variants and expose an authenticated save/unsave action.
- Job seekers can apply with a cover letter, resume, portfolio, and expected salary, then track
  applications and saved jobs.
- Employers can manage their company profile, publish jobs, and review applicants.
- The CV builder supports persistent drafts, file import, live preview, printing, and Groq-assisted
  summaries. Contact messages and notifications are also connected to the API.

Set `NEXT_PUBLIC_API_URL` (see `.env.example`) to point at the API.

## Fonts

The layout currently uses a system font stack (`Segoe UI` / system-ui) because this sandbox
couldn't reach Google Fonts at build time. To use **Inter** as designed, in `app/layout.tsx`:

```tsx
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", weight: ["400","500","600","700","800"] });


## Design tokens (from the design process PDF)

| Token | Hex |
|---|---|
| Brand Green | `#00653B` |
| Dark Green | `#015230` |
| Primary | `#041603` |
| Success | `#22C55E` |
| Cyan Accent | `#38BDF8` |
| Orange Accent | `#F97316` |
| Red Accent | `#EF4444` |
| Purple Accent | `#7C3AED` |
| Page BG | `#F5F7FA` |
| Border | `#E2E8F0` |
| Text (ink) | `#1E293B` |

## Build

```bash
npm run build
npm start
```

The production build and TypeScript validation were verified successfully at handoff.
