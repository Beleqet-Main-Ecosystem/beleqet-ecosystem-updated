## Summary

Adds the **Admin Stats** module (Admin & Control) so platform admins can see performance, revenue, user activity, and freelance project progress in one place — backed by NestJS APIs and a Recharts admin dashboard.

Admins can filter by date range and currency, drill into system health, export self-explanatory CSVs, and act on aggregates without exposing PII.

### Backend (`src/modules/admin-stats`)

- Clean architecture: **Controller → Service → Repository**
- Endpoints under `/api/v1/admin-stats`:
  - `GET /overview` — 6 KPI cards + system snapshot
  - `GET /charts/revenue` — zero-filled revenue series (fees + payments + subscriptions − refunds, FX-aware)
  - `GET /charts/users` — registrations + active users
  - `GET /projects/breakdown` — status mix + recent freelance projects
  - CSV exports for overview, revenue, users, status, and recent projects
- Auth: `JwtAuthGuard` + `Roles('ADMIN')` + `RequirePermissions('view:stats')`
- GDPR-safe: owner **first name only** on recent projects; no emails/phones; no secrets in responses
- `users.lastLoginAt` for active-user metrics (password, OAuth, and 2FA login paths)
- Self-documenting CSV files (metadata block, human headers, readable money + raw minor units, notes)

### Frontend (`frontend` admin dashboard)

- New `/admin/dashboard` experience: summary cards, system health, revenue & user-growth charts, project status pie, recent projects table
- Filters: `7d` / `30d` / `12m` / **custom from–to**, currency select, live refresh (~30s)
- Recent projects: **8 rows per page** with pagination (API default recent limit **10**)
- Dark-mode palette scoped to **dashboard tab only** (`.admin-stats-dashboard`) — other admin tabs unchanged
- Professional Lucide icons (no trash icons); ↑/↓ trend labels (not color-only)

### Docs & quality

- Phase 1 data map + Phase 2 dashboard/API/CSV spec + Phase 4 test notes
- Demo seed: `npm run prisma:seed:admin-stats`
- Manual verify helper: `tools/admin-stats-manual-verify.ts`

## Why

Gives admins a trustworthy, scan-friendly control panel for decisions — with NestJS SOLID layering, Jest coverage, and GDPR-conscious payloads so the PR meets Beleqet quality standards.

## Test plan

- [x] `npx jest src/modules/admin-stats` (unit + HTTP security)
- [x] `cd frontend && npm test` (pagination, chart theme, recent table)
- [ ] Local smoke: login as ADMIN with `view:stats` → `/admin/dashboard` loads cards/charts/table
- [ ] Non-admin / missing permission → `403` on `/admin-stats/*`
- [ ] Range pills + custom dates + currency change refresh data
- [ ] Recent projects paginate (8/page); owner shows first name only
- [ ] Download each CSV and confirm metadata + readable columns open cleanly in Excel/Sheets
- [ ] Dark mode contrast OK on dashboard; Disputes / Audit / Notifications tabs unaffected
- [ ] Optional: `npx ts-node --transpile-only tools/admin-stats-manual-verify.ts --live`
- [ ] CI green on PR (`lint`, `format:check`, `tsc`, `build`, `npm test`)

## Security & GDPR

- Admin + `view:stats` only
- Aggregates preferred; recent list limited to `ownerFirstName`
- No API keys / passwords in responses or CSV exports
- Unsupported FX currencies fail with **400** (no silent wrong totals)

## Notes / follow-ups (not blocking)

- Optional DB indexes for hot stats query paths
- UI toggle for `applyRangeToProjects` (API already supports it)
