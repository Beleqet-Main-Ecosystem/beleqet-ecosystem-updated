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
| U22 | Freelance list | Save is back on project cards and stays saved (A29) | Fixed |
| U23 | Freelance list | Cards show the client as first name and initial, e.g. Abebe K. (A30) | Fixed |
| U24 | Freelance list | Budget sort is done by the API across all projects and kept in the URL (A27) | Fixed |

| U25 | Project detail | Made-up demo projects shown when the API failed or the project was missing | Fixed |
| U26 | Post a project | "Post a project" opened the job form, which cannot create a project; new page at /freelance/post | Fixed |
| U27 | Project detail | Client shows member since and completed contracts; each bid shows the freelancer's completed contracts, member since and portfolio link (A35) | Fixed |
| U28 | Post a project | Attachments go up to 10 MB, as designed; all uploads (CVs, project files, work) now allow 10 MB, and staging nginx accepts that size | Fixed |

| U29 | Contract | Browser pop-ups replaced with in-page dialogs; added "Add milestone", which the API had but no page offered | Fixed |
| U30 | Contract | Fund button showed even when escrow was already funded; the contract now returns the escrow status | Fixed |
| U31 | Contract | Activity comes from the event log: proposals, acceptance, work, revisions, approvals, funding, disputes (A38). Milestones the freelancer adds wait for the client to accept or decline (A14) | Fixed |
| U32 | Contract | Design says fund with Telebirr, CBE Birr or Chapa; wording kept general until the payment route is confirmed | Open |

Kept beyond the design: budget sort, the four escrow steps, "Join as a freelancer".

Not tested: paying into escrow. It needs the Chapa test keys (C5), so the contract tests set "funded" directly in the local database.

## UI/UX: Tier 3 hiring and plans

| # | Page | Issue | Status |
|---|---|---|---|
| U33 | Post a job | Salary period, years of experience, qualification, own website link and urgent were missing; all now saved | Fixed |
| U34 | Post a job | Logo is set on the company profile (Company tab), which now edits; it shows on the employer's job cards | Fixed |
| U35 | Pricing | Question about reaching the job-post limit is back now that the limit is enforced (A39) | Fixed |
| U36 | Pricing | "Subscribe" can't complete until PayPal plan IDs are set or another payment route is chosen (A21, C4) | Blocked |
| U37 | Seeker dashboard | Old "Your opportunities", profile and dashboard pages merged into one; subscription cancel and interview availability moved in | Fixed |
| U38 | Seeker dashboard | Freelancers had no page for My bids or Contracts; added both | Fixed |
| U39 | Messages | Page claimed "Encrypted socket transmission", which isn't true; removed | Fixed |
| U40 | Messages | Rebuilt to the design: conversation list and thread, phone layout, unread dots, Amharic. "Message" on applicants and interviews now opens a chat with that person (A44). Live chat not re-tested end to end: Docker was down | Fixed |
| U41 | Seeker dashboard | Dashboard "Jobs for you" uses the personalised feed (A12) | Fixed |
| U42 | Seeker dashboard | Job alerts are in Settings (A18) and profile photos can be added. "Preview as employer" not built: there is no employer view of a candidate profile yet | Fixed |
| U43 | Settings | Two-step sign-in card in Settings (job seekers) and a new Settings tab (employers): turn on with a QR code, backup codes to download, turn off, new codes (A45) | Fixed |
| U44 | Settings | Delete account works from Settings on both dashboards: password, type DELETE, refused while a contract is open (A40) | Fixed |
| U45 | Interviews | Candidates see place, video link and notes, and confirm or decline; employers set them and see the answer (A19) | Fixed |
| U46 | Employer dashboard | Company profile edits; trade licence upload with Not verified / Being checked / Verified / Not approved and the admin's reason (A16, A17) | Fixed |
| U47 | Employer dashboard | No "Edit job" yet: Post a job only creates. Added an Edit button on each job; it opens the Post a job form filled in, at /post-job?edit=id. Needed A43 | Fixed |
| U48 | Employer dashboard | Billing history and pay-by-bank-transfer for plans in the Plan tab (A20). The account to pay into is needed (A49); until set, the page says to contact us | Fixed |

## UI/UX: Tier 4 career tools

| # | Page | Issue | Status |
|---|---|---|---|
| U49 | Tax calculator | United States option removed to match the design (decided 2026-11-02: Ethiopia only) | Fixed |
| U50 | Tax calculator | 2025 bands applied (0% to 2,000, then 15, 20, 25, 30, 35%; deductions 300 to 2,050) with 7% pension; the warning is gone | Fixed |
| U51 | Feed | Reasons under each job, Hide kept on the server, recent searches shown, feed switch in Settings (A11, A12, A46) | Fixed |
| U52 | Forum | Nobody could post, reply or vote: the page read the wrong token name, and a helper dropped the request's content type. Both fixed | Fixed |
| U53 | Forum | Anonymous posts showed "Deleted User"; they now show "Anonymous" | Fixed |
| U54 | Forum | Report on threads and replies (A5), admin Pin and Lock, Most voted and Unanswered sorts (A9). "Oldest" removed: the API never supported it and it always errored | Fixed |
| U55 | Voice to text | Removed the "Conversation ID" box; a conversation is now created silently. Actual speech wasn't tested: it needs the Whisper service running | Fixed |
| U56 | Voice to text | Amharic transcripts are kept and end with ። (A22). Real speech still untested without the Whisper service | Fixed |
| U57 | CV Maker | The broken "Upload an existing CV" box is gone, as in the design; "Fill from my old CV" opens Resume Brain, whose "Use these in CV Maker" now fills the CV | Fixed |
| U58 | CV Maker | Rebuilt to the design: collapsible sections with a summary of each, all text in English and Amharic, no "Groq". Several broken dark-mode classes removed | Fixed |
| U59 | Resume Brain | Rebuilt to the design with Upload, Reading, Review and Done screens, and "Use these in CV Maker". "Delete the uploaded file" always failed (it sent the wrong id); fixed. Light mode showed green text on near-black; fixed. Real CV reading not tested: it needs the OpenAI key | Fixed |

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
| C9 | Tax calculator (A24) | Current employment tax bands from the Ministry of Revenue | Received |
| C10 | Testing and release | Staging and VPS access or a deploy contact | Missing |
| C11 | Imported jobs (A25) | Who owns the job import, to fix company names and salaries | Missing |

## Backend: after UI/UX

| # | Issue | Size |
|---|---|---|
| A1 | Google and LinkedIn sign-in now return to the website (tokens in the URL fragment, /auth/callback stores them) and the sign-in and job-seeker sign-up pages have the buttons. Disabled accounts are refused, and accounts with two-step sign-in must still enter their code (OAuth used to skip it). Not tried with real providers: needs C1, C2 | Done |
| A2 | New POST /auth/resend-verification (signed in, 3 an hour, old links stop working); dashboards remind unverified people with a resend button | Done |
| A3 | Search takes several job types (the website now uses checkboxes, as designed), minimum salary, experience level, posted within N days, sort by salary, and matches tags. The design has no salary, experience, date or sort controls, so those are API-only for now | Done |
| A4 | Jobs past their deadline or expiry date are left out of search, the feed and the homepage count, and applications to them are refused | Done |
| A5 | POST /reports (jobs, threads, replies; once per person); admins dismiss or remove content in the new Review tab | Done |
| A6 | Search takes company (and exclude); the job page has "More jobs from this employer", as designed | Done |
| A7 | Job lists no longer send descriptions or requirements; the page size is capped at 500 (the sitemap uses 500) | Done |
| A8 | GET and PUT /users/portfolio save the portfolio builder | Done |
| A9 | Admin pin and lock: PATCH /forum/threads/:id/moderation; reports cover forum posts; the popular sort already existed | Done |
| A10 | Fewer than 3 matching salary postings returns NOT_ENOUGH_DATA (422) instead of a figure built from a made-up 80,000 base | Done |
| A11 | POST and DELETE /ai-feed/hidden/:jobId; hidden jobs leave the feed on every device | Done |
| A12 | Each feed job carries reasons (skills, searches, saved categories) in the person's words; GET /ai-feed/signals | Done |
| A13 | Settling a dispute refunds, releases or splits what escrow still holds, in one transaction and only once; both admin routes use it; admins settle in the Review tab | Done |
| A14 | Freelancer milestones start as PROPOSED for the client to accept or decline; all milestones together can't exceed the contract amount | Done |
| A15 | Duplicate bids return a clear 409, even when sent at the same moment | Done |
| A16 | PATCH /users/company; renaming a verified company removes the badge until it is checked again | Done |
| A17 | POST /users/company/verification with the licence; admin list and decision, with a reason when rejected | Done |
| A18 | /job-alerts (up to 10 per person). Every new job used to email every job seeker; now only matching alerts get it, and not people who turned email off | Done |
| A19 | GET /interview-planner/interviews; candidates confirm or decline (the employer is notified); employers set place, link and notes | Done |
| A20 | Bank transfers can pay for a plan at the plan's price; approval starts or extends the plan, once only; GET /manual-payment/mine. Also fixed: anyone could read anyone's payment and receipt by id | Done |
| A21 | PayPal plan IDs are empty, so nobody can subscribe | Small |
| A22 | Amharic transcripts were dropped as having "no letters"; fixed | Done |
| A23 | CV Maker upload called an endpoint that doesn't exist; the upload now lives only in Resume Brain, which works | Done |
| A24 | Website calculator and API use the 2025 bands; tests check them against the official deduction table | Done |
| A25 | Imported jobs have no real company name or salary | Data |
| A26 | Done early: added public GET /freelance/categories, which Post a project needs | Done |
| A27 | The project list sorts by budget on the server | Done |
| A28 | Project search covers skills; budget, pricing type and experience filters (API) | Done |
| A29 | Saved projects: GET /freelance/saved, POST and DELETE /freelance/jobs/:id/save | Done |
| A30 | The project list returns clientName (first name and initial) | Done |
| A31 | The test that left these rows also ran TRUNCATE users CASCADE on whatever database it used; it now removes only its own rows. The migration deletes the leftover categories | Done |
| A32 | **Privacy:** bids are no longer in the public project API. New GET /freelance/jobs/:id/bids (sign-in): the owner sees every bid, a bidder only their own | Done |
| A33 | Clients can't bid on their own project; employer and admin accounts can't bid | Done |
| A34 | Retrying payment charges the agreed bid amount when escrow was set up from the budget | Done |
| A35 | Bids include completed contracts, member since and portfolio; projects include the client's | Done |
| A36 | A retry on an unpaid escrow opens a new checkout instead of returning the contract page | Done |
| A37 | **Revision requests drop the reason:** the note is now required, saved in the event log and shown on the contract. Only submitted work can be sent back | Done |
| A38 | GET /freelance/contracts/:id returns activity from the event log; proposals, acceptance, submissions and disputes are now logged | Done |
| A39 | Plan limits enforced: POST /jobs counts posts made in the billing period (calendar month on Free) against maxJobPosts and refuses Featured without the plan. New GET /jobs/my/quota feeds the page. Admins are exempt | Done |
| A40 | POST /v1/compliance/gdpr/erase-me (password, or none for Google/LinkedIn-only accounts; refused while a contract is open). The GDPR module was never registered, so admin erasure was unreachable too; fixed | Done |
| A41 | Empty links now clear (profile, company, interview links) | Done |
| A42 | **Privacy:** anonymous threads and replies now return userId as null | Done |
| A43 | **Security:** PATCH /jobs/:id skipped validation, so an employer could set any column, including companyId to move a job to another company. Now validated and whitelisted; dates are converted as on create (a date-only deadline used to fail), optional fields can be cleared with null, and required ones can't | Done |
| A44 | **Chat never worked:** the socket read `userId` from the token, which carries `sub`, so joining a room and sending always failed. Fixed. Also: rooms can only be opened between contract parties or an applicant and the employer they applied to (anyone could message anyone, and attach any contract); a second request reuses the room; history returns the latest 50 messages, not the first 50; rooms carry the job, sort by last message and report unread; new POST /chat/rooms/:id/read | Done |
| A45 | Two-step sign-in: new GET /auth/2fa/status; enrolment also returns a QR image so the website needs no QR library | Done |
| A46 | Personalised feed switch: PATCH /users/profile takes gdprConsent and records when it was given or withdrawn; GET returns it | Done |
| A47 | **Security:** GET /applications/:id returned any application to any signed-in user, with the applicant's full account row including the password hash. Now the applicant or the hiring employer only, with safe fields | Done |
| A48 | The admin disputes list sent full user rows (password hashes included) to the browser; now names and emails only | Done |
| A49 | Content needed: the bank account people pay into for bank transfers. Set NEXT_PUBLIC_BANK_TRANSFER_DETAILS | Blocked |
