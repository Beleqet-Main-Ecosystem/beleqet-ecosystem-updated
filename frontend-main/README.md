# Beleqet Jobs — Next.js

Next.js (App Router) port of the Beleqet Jobs & Freelance homepage.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000

## Structure

- `app/layout.js` — root layout, fonts (Sora, Inter, Noto Sans Ethiopic), page metadata
- `app/globals.css` — all site styles (unchanged from the static build)
- `app/page.js` — the homepage. Marked `"use client"` because the page is
  interactive: a `useEffect` hook wires up the Jobs/Freelance toggle, the
  split-flap job board animation, the count-up stats, the logo/testimonial
  marquees, and scroll-reveal — ported directly from the original vanilla JS.

## Notes / next steps

- Job, gig, testimonial, and company data are hard-coded placeholders inside
  `app/page.js` (see the `jobs`, `gigs`, `featuredJobs`, `featuredGigs`,
  `testimonials`, and `companies` arrays). Swap these for a real API/CMS call
  when ready — the simplest path is to fetch the data in a server component
  and pass it down as props, then replace the `innerHTML` rendering in the
  `useEffect` with real React state + JSX.
- All icons are inline SVG, no image assets required.
- Fonts load from Google Fonts via `<link>` tags in `app/layout.js`. Swap to
  `next/font/google` later if you want self-hosted fonts.
