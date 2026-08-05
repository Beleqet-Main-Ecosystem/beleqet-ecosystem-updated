# Admin Stats — Phase 4 Test Report

**Date:** 2026-08-04  
**Module:** `src/modules/admin-stats`  
**Goal:** Prove calculations, zero-fills, and security gates.

---

## 1. Automated suite (mandatory for PR)

| Suite | File | What it proves |
| --- | --- | --- |
| Unit / logic | `admin-stats.spec.ts` | Overview counts, MoM %, zero-filled revenue, status grouping, empty edges, CSV |
| HTTP security | `admin-stats.http.spec.ts` | 403 for seeker/employer/unauth; 200 for ADMIN+`view:stats`; RolesGuard unit cases |
| Shared fixtures | `__fixtures__/admin-stats.fixtures.ts` | Single calculator source for expected numbers |

### Run

```bash
npx jest src/modules/admin-stats --passWithNoTests
```

### Fixture calculator (hand-check)

| Metric | Expected |
| --- | --- |
| Total users | **5** |
| Active users (30d as-of 2026-08-04) | **3** |
| Total projects | **5** |
| Active projects (not COMPLETED/CANCELLED) | **3** |
| Revenue Aug | **350** (= 100 + 250) |
| Revenue Jul | **200** |
| MoM % | **75** (= (350−200)/200×100) |
| Chart Aug 1–4 | 100, **0**, 250, **0** |

---

## 2. Manual gate checklist

Use a running API + seeded admin (`ADMIN_EMAIL` / `ADMIN_PASSWORD`) and a normal user.

```bash
# Print fixture expectations + checklist
npx ts-node --transpile-only tools/admin-stats-manual-verify.ts

# Optional: print live user/project counts from DATABASE_URL
npx ts-node --transpile-only tools/admin-stats-manual-verify.ts --live
```

| # | Step | Pass criteria |
| --- | --- | --- |
| 1 | `POST /auth/login` as JOB_SEEKER, then `GET /admin-stats/overview` | **403** (generic Forbidden — no “dashboard” leak) |
| 2 | Same as EMPLOYER | **403** |
| 3 | Login as ADMIN with RBAC `view:stats` | **200** on overview, charts, breakdown, CSV |
| 4 | Overview vs DB counts | `totalUsers` / projects match SQL `COUNT(*)` |
| 5 | Empty month / no activity | Zeros, not 500s |
| 6 | Recent projects JSON | `ownerFirstName` present; **no** email/phone |
| 7 | Revenue chart gaps | Days without fees appear as `revenue: 0` |

### Example curl

```bash
# Non-admin (expect 403)
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $SEEKER_TOKEN" \
  http://localhost:3000/admin-stats/overview

# Admin (expect 200)
curl -s -H "Authorization: Bearer $ADMIN_TOKEN" \
  "http://localhost:3000/admin-stats/overview?currency=ETB&range=30d&tz=UTC" | jq .
```

---

## 3. Edge cases covered in automation

- Empty tables → all cards `0`, MoM `percentChange: null`, `direction: "flat"`
- Month with revenue / prior month zero → `direction: "new"`
- Month with zero / prior month positive → `direction: "down"`, `-100%`
- User growth period with no registrations → zero-filled series
- Status summary includes enum values with **count 0**
- GDPR: recent list never includes email/phone

---

## 4. Sign-off

| Check | Status |
| --- | --- |
| Automated tests green | See CI / local jest output |
| Security 403/200 proven | `admin-stats.http.spec.ts` |
| Manual calculator matches fixtures | Section 1 table |
| Manual HTTP gates | Checklist §2 |

**Phase 4 complete when:** `npx jest src/modules/admin-stats` passes and the §2 checklist is exercised against a running stack.
