# Dark/Light Mode Module

**Task ID:** User Experience & UI — Dark/Light Mode
**Scope:** This module only. No other feature, page, or backend code was touched.

## Why this folder exists

The `beleqet-ecosystem-updated` repo is currently NestJS-only — there is no
Next.js/React app anywhere in it. Since this task explicitly asks for a
React/Next.js implementation using Tailwind's dark-mode class strategy or
`next-themes`, there was nothing to mount it on. This folder is a **minimal**
Next.js scaffold added solely to host and demonstrate the module — it is not
an attempt to design the platform's real frontend, and no unrelated pages,
routes, or dependencies were added beyond what's needed to run and test
`src/theme/`.

## Running it

```bash
npm install
cp .env.example .env.local   # optional — defaults to "system" without it
npm run dev                  # http://localhost:3000
npm test                     # Jest unit tests
```

## What's in `src/theme/`

| File | Purpose |
|---|---|
| `theme.types.ts` | `ThemePreference` union + supported locales |
| `theme-preference.dto.ts` | `class-validator` DTO validating any value read from `localStorage` |
| `ThemeProvider.tsx` | Wraps `next-themes`; the module's composition root |
| `useTheme.ts` | Typed hook every consumer uses instead of touching `next-themes` directly |
| `ThemeToggle.tsx` | The visible toggle switch (Light → Dark → System) |
| `i18n/theme.i18n.ts` | Locale dictionary for the toggle's labels |
| `ThemeToggle.spec.tsx` | Jest + React Testing Library unit tests |

## README Rule-by-Rule Notes

Some of the six project-wide rules were written with backend NestJS modules
in mind. Rather than silently skip the ones that don't map 1:1 onto a
frontend UI toggle, here's how each was handled:

1. **Modular Architecture (NestJS Module + DI):** Not literally applicable —
   there's no Nest DI container on the client. The equivalent applied here:
   every consumer gets the theme through `useTheme()`/`<ThemeProvider>`
   rather than reaching into `localStorage` or `next-themes` directly, so
   the module has one composition root and one public surface (`index.ts`),
   the same decoupling DI gives the backend modules.
2. **Clean Code & Naming:** camelCase for variables/functions, PascalCase
   for components/classes/types throughout.
3. **Data Security & Validation:** No secrets are used by this module. The
   one piece of "input data" it has — the persisted preference in
   `localStorage` — is validated with `class-validator` via
   `ThemePreferenceDto` before it's ever trusted (see `theme-preference.dto.ts`).
   Config (default theme) is read from an env var, not hardcoded.
4. **TypeScript Strict Mode:** `strict: true` in `tsconfig.json`, zero uses
   of `any` anywhere in the module.
5. **Documentation:** Every exported function/component has a TSDoc block.
6. **Testing:** `ThemeToggle.spec.tsx` covers rendering, the click-cycle
   behavior, persistence, locale switching, and the validator's accept/reject
   paths.

**Global Scaling notes:**
- **i18n:** No label string is hardcoded in a component — everything comes
  from `i18n/theme.i18n.ts` (English + Amharic included). This is a small,
  local dictionary rather than a full framework, scoped to match "implement
  only the assigned module"; swapping it for `next-intl` later only touches
  this one file.
- **GDPR:** The preference is stored in `localStorage`, not a cookie, isn't
  personal data, and isn't used for tracking — it's a strictly functional
  preference, so it doesn't require cookie-consent banner opt-in. Noted
  here explicitly rather than left unaddressed.
- **Multi-currency:** Not applicable to a theme toggle; noted rather than
  silently ignored.
