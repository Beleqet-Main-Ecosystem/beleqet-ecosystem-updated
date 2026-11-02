# Redesign issues log

Every gap found during the Beleqet redesign. Nothing is dropped silently: an item stays here until it is fixed.
Order agreed on 2026-11-02: finish UI/UX first, then backend.

Status: **Open**, **Fixed**, **Blocked** (needs something from outside the code).

## UI/UX: Tier 1 catch-up

| # | Page | Issue | Status |
|---|---|---|---|
| U1 | Job detail | Apply form lost Portfolio URL and Expected salary | Fixed |
| U2 | Header, menu, footer, landing | Portfolio links removed | Fixed |
| U3 | Landing | Dropped from the design: interview scheduling, portfolio builder, assistant, some footer links | Fixed |
| U4 | Header | Notification bell invisible on the dark header | Fixed |
| U5 | Header | Account menu text is English only | Fixed |
| U6 | Job detail | Save button differs from the design (should be outlined with a "Save" label) | Fixed |
| U7 | Search | "Remote" location shortcut from the design is missing | Fixed |
| U8 | Search | City shortcuts and popular searches stay English in Amharic | Fixed |
| U9 | Search | A page number past the end says "no jobs match" | Fixed |
| U10 | Search | Saving a job while signed out loses your search after sign-in | Fixed |
| U11 | Sign in | Two-step code is one box; the design has six | Fixed |
| U12 | Sign in | "Keep me signed in" missing | Fixed |
| U13 | All | "up to" in salaries is English only | Fixed |
| U14 | Search, detail, sign in | Dark mode not checked | Fixed |
| U15 | Job detail, all pages | Dark mode: Apply button dark on dark, bright deadline banner, mixed page backgrounds | Fixed |
| U16 | All | Dark mode: page background is navy under a green header; the brand's dark is green-black | Fixed |
| U17 | Sign in | Backup-code sign-in is built but has not been tested end to end | Fixed |

Checked 2026-11-02: 16 browser checks on the running dev server, 193 unit tests, production build. Amharic strings still need review (B5).

## UI/UX: Tier 2 freelance

| # | Page | Issue | Status |
|---|---|---|---|
| U18 | Freelance list | Showed nine made-up sample projects when the API had none | Fixed |
| U19 | Freelance list | Invented claims: 98% on-time payouts, 0% disputes lost, 24/7 monitoring, "thousands" of users, verified talent, skill badges, AI matching, star ratings | Fixed |
| U20 | Freelance list | Category filters used slugs that match no real category, so they returned nothing | Fixed |
| U21 | Freelance list | Search sent people to the feed page instead of searching projects | Fixed |
| U22 | Freelance list | Save button on cards was removed: it never saved anything and was lost on reload. Needs A29 before it can return | Open |
| U23 | Freelance list | Client name was removed from cards: every card said "Verified Client". Needs A30 | Open |
| U24 | Freelance list | Budget sort only covers projects already loaded. Needs A27 | Open |

| U25 | Project detail | Made-up demo projects shown when the API failed or the project was missing | Fixed |
| U26 | Post a project | "Post a project" opened the job form, which cannot create a project; new page at /freelance/post | Fixed |
| U27 | Project detail | Design shows freelancer "completed contracts", client "member since" and "View portfolio"; hidden until A35 | Open |
| U28 | Post a project | Design says attachments up to 10 MB; the upload limit is 5 MB, so the page says 5 MB | Open |

| U29 | Contract | Browser pop-ups replaced with in-page dialogs; added "Add milestone", which the API had but no page offered | Fixed |
| U30 | Contract | Fund button showed even when escrow was already funded; the contract now returns the escrow status | Fixed |
| U31 | Contract | Activity is built from contract dates only, so it misses revision requests and disputes (needs A38) | Open |
| U32 | Contract | Design says fund with Telebirr, CBE Birr or Chapa; wording kept general until the payment route is confirmed | Open |

Kept beyond the design: budget sort, the four escrow steps, "Join as a freelancer".

Not tested: paying into escrow. It needs the Chapa test keys (C5), so the contract tests set "funded" directly in the local database.

## Blocked: needs a decision or content

| # | Issue | Needs |
|---|---|---|
| B1 | Register links only the Privacy policy; there is no Terms page | Terms text from the CTO or legal |
| B2 | Android card hidden on the landing page | Public Google Play link |
| B3 | Telegram mini app button hidden | Mini app link, if it is live |
| B4 | Floating chat button and phone tab bar aren't in the design | Decision: keep, restyle or remove |
| B5 | Amharic has not been reviewed by a native speaker | Reviewer |

## Credentials and access (from the CTO)

Put secrets in `.env` or a password manager, not in chat.

| # | Needed for | What | Status |
|---|---|---|---|
| C1 | Google sign-in (A1) | Confirm the client ID and secret in `.env` are valid; add the production callback URL in Google Cloud | Values present, not verified |
| C2 | LinkedIn sign-in (A1) | Same, in the LinkedIn developer app | Values present, not verified |
| C3 | Verification and reset emails (A2) | Confirm the SMTP account can send from the production domain | Values present, not verified |
| C4 | Paid plans (A21) | PayPal plan IDs for Pro and Enterprise, or a decision to use Chapa or Telebirr | Missing |
| C5 | Escrow testing | Chapa test keys and webhook secret for staging | Values present, not verified |
| C6 | CV and file uploads | Production storage details; `S3_BUCKET` isn't set under that name, to be checked | Unknown |
| C7 | Android card (B2) | Public Google Play link | Missing |
| C8 | Telegram (B3) | Mini app link | Missing |
| C9 | Tax calculator (A24) | Current employment tax bands from the Ministry of Revenue | Missing |
| C10 | Testing and release | Staging and VPS access or a deploy contact | Missing |
| C11 | Imported jobs (A25) | Who owns the job import, to fix company names and salaries | Missing |

## Backend: after UI/UX

| # | Issue | Size |
|---|---|---|
| A1 | Google and LinkedIn sign-in never return to the website | Medium |
| A2 | No "resend verification email" endpoint | Small |
| A3 | Search: salary, experience and date filters, sorting, several job types | Medium |
| A4 | Expired jobs still listed; applications accepted after the deadline | Small |
| A5 | No "Report this job" endpoint or admin review | Medium |
| A6 | No filter for "More jobs from this employer" | Small |
| A7 | Job lists send full descriptions (76 KB per 20 jobs) | Small |
| A8 | Portfolio builder has no save or load endpoints | Medium |
| A9 | Forum: report, pin and lock need endpoints and an admin view | Medium |
| A10 | Salary insights invent figures when data is thin | Medium |
| A11 | No "not interested" endpoint for Jobs for you | Small |
| A12 | Jobs for you must return why each job matched | Small |
| A13 | Dispute resolution must move the money (refund, release or split) | Medium |
| A14 | Milestones need client approval and a cap at the contract amount | Medium |
| A15 | One freelancer can bid twice on a project | Small |
| A16 | Company profile can't be edited | Small |
| A17 | Company verification: trade licence upload and admin review | Medium |
| A18 | Job alerts have no endpoints | Medium |
| A19 | Candidates can't list, confirm or decline interviews | Medium |
| A20 | Bank-transfer payments don't activate a plan; plan limits unconfirmed | Medium |
| A21 | PayPal plan IDs are empty, so nobody can subscribe | Small |
| A22 | Voice to text discards Amharic transcripts | Small |
| A23 | CV Maker upload calls an endpoint that doesn't exist | Small |
| A24 | Tax calculator: brackets out of date, no pension | Medium |
| A25 | Imported jobs have no real company name or salary | Data |
| A26 | Done early: added public GET /freelance/categories, which Post a project needs | Done |
| A27 | Freelance list has no server-side sort | Small |
| A28 | Project search doesn't search skills; the list also has no budget, pricing type or experience filters | Small |
| A29 | No saved projects endpoints | Medium |
| A30 | Project list doesn't return the client's name | Small |
| A31 | Test runs leave "GDPR Test Category" rows in the database | Small |
| A32 | **Privacy:** GET /freelance/jobs/:id is public and returns every bid, with price and cover letter, to anyone. The website hides them, but the API must too | Small |
| A33 | Any account can bid, including a client on their own project | Small |
| A34 | "Fund escrow" must be reachable from the contract; check the amount after a bid is accepted | Small |
| A35 | Bids and projects need completed-contract count, member-since date and portfolio link | Small |
| A36 | Fund escrow: a second try returns the contract page instead of a payment link, so an abandoned payment can't be resumed | Small |
| A37 | **Revision requests drop the reason:** the client's note is never saved, so the freelancer can't see what to change | Small |
| A38 | Contract needs an activity feed from EventLog | Small |
