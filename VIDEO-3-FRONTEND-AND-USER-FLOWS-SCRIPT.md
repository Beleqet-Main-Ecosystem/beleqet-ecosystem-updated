# Beleqet Ecosystem: Handover Video 3 — Frontends, Portals & User Journeys
## (የፊት ለፊት ፖርታሎች፣ የተጠቃሚ ጉዞዎች እና የክፍያ ፍሰቶች የተግባር መመሪያ ስክሪፕት)

**Audience:** Frontend Engineers, Full-Stack Developers, Product Owners, UI/UX Leads  
**Topic:** Video 3 — Multi-Frontend Architecture (Jobs Portal, Admin Panel, Freelance Hub, Pay Landing), State Management, and User Flows  
**Estimated Duration:** ~12 – 15 Minutes  
**Format:** Screen Recording + Voice Narration (Amharic & English for Every Scene)  

---

## 📋 Pre-Recording Setup Checklist (ከመቅረጽህ በፊት አዘጋጅ)

1. **Browser Tabs Ready:**
   * Tab 1: Beleqet Jobs Portal (`http://localhost:3000` or staging `https://jobs.beleqet.com`)
   * Tab 2: Freelance Marketplace (`http://localhost:3000/freelance`)
   * Tab 3: Admin Dashboard (`http://localhost:3002` or `frontend/`)
   * Tab 4: Beleqet Pay Landing (`beleqet-pay-landing/index.html` or staging URL)
   * Tab 5: Browser DevTools (Network tab + Console open)

2. **VS Code Files Ready in Tabs:**
   * `beleqet-jobs-nextjs/app/page.tsx` (Jobs Landing & Hero Search)
   * `beleqet-jobs-nextjs/app/freelance/page.tsx` (Freelance Marketplace Layout)
   * `beleqet-jobs-nextjs/lib/api.ts` or auth storage hook (JWT & LocalStorage handling)
   * `frontend/src/app/admin/dashboard/page.tsx` (Admin Analytics & Controls)

3. **Demo User Accounts Ready:**
   * Job Seeker: `candidate@test.com` / `Candidate@123`
   * Employer: `employer@test.com` / `Employer@123`
   * Super Admin: `admin@beleqet.com`

---

## 🎬 Scene-by-Scene Recording Script

---

### Scene 1: Multi-Frontend Architecture Overview (00:00 – 01:30)

**What to show on screen:**
* Open VS Code project tree showing:
  * `beleqet-jobs-nextjs/` (Next.js 14 App Router — Candidate & Employer Portal)
  * `frontend/` (Next.js Admin Dashboard)
  * `beleqet-pay-landing/` (Lightweight marketing & payment checkout landing)
* Open browser showing the main landing page `http://localhost:3000`.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "እንኳን ወደ ቪዲዮ 3 በደህና መጡ! በዚህ ቪዲዮ ውስጥ የ Beleqet Ecosystem የፊት ለፊት ገጾችን ወይም Frontends እናያለን። ሲስተማችን ሞኖሊቲክ የሆነ አንድ ፔጅ ብቻ ሳይሆን፣ እንደ ፍላጎቱ የተከፋፈሉ ራሳቸውን የቻሉ አፕሊኬሽኖች አሉት። የመጀመሪያው `beleqet-jobs-nextjs` ሲሆን እጩዎች ስራ የሚፈልጉበት እና ቀጣሪዎች ማስታወቂያ የሚለጥፉበት ነው። ሁለተኛው `frontend` የሲስተም አድሚኖች ቁጥጥር የሚያደርጉበት ዳሽቦርድ ነው። ሦስተኛው ደግሞ `beleqet-pay-landing` ለክፍያ እና ማስተዋወቂያ የተዘጋጀ ነው። አሁን እያንዳንዱን ጉዞ በተግባር እንይ።"

> **English:**  
> "Welcome to Video 3! In this walkthrough, we will explore the Beleqet Ecosystem frontends and user journeys. Rather than a single monolithic UI, our ecosystem is structured into dedicated, decoupled applications: `beleqet-jobs-nextjs` for job seekers and employers, `frontend` for the central administrative control panel, and `beleqet-pay-landing` for payment processing and public landing. Let's walk through each user experience step by step."

---

### Scene 2: Candidate Journey — Job Discovery & Application Flow (01:30 – 04:30)

**What to show on screen:**
* Navigate to `http://localhost:3000`.
* Type a search query (e.g., "Software Engineer" or "Addis Ababa").
* Filter by Job Type (Full-time, Remote).
* Click on a job card to open the Job Details view.
* Show the "Apply Now" modal with CV upload, Cover Letter, and AI Skill Matching indicator.
* Inspect Network Tab in DevTools: Show the `POST /api/v1/applications` request with authorization Bearer token.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "እዚህ እንደምታዩት የስራ ፈላጊዎች ዋና መነሻ ገጽ ነው። ተጠቃሚው በስራ አይነት፣ በቦታ እና በደመወዝ መጠን በቀላሉ ፈልጎ ማግኘት ይችላል። አንድ ስራ መርጠን ስንከፍት ሙሉ የስራውን መግለጫ እና መስፈርቶች ያሳየናል። 'Apply Now' ስንጫን፣ የ CV ፋይል እንጭናለን። ሲስተሙ በ AI አማካኝነት የሲቪውን ይዘት ከስራው መስፈርት ጋር አነጻጽሮ የመመሳሰል ነጥብ (Match Score) ይሰጠዋል። በኔትወርክ ታብ ላይ እንደምታዩት ጥያቄው በደህንነት በ JWT Token ታጅቦ ወደ ባክኤንድ ይላካል፤ ወዲያውኑ ማመልከቻው ይመዘገባል።"

> **English:**  
> "Here is the candidate landing experience. Users can search and filter opportunities across categories, locations, and salary ranges in real time. Opening a job displays its full requirements and benefits. When clicking 'Apply Now', applicants upload their CV. Our backend AI resume engine evaluates candidate skills against the job specifications to calculate an automated match score. Notice in the DevTools Network panel how requests are authenticated via secure JWT tokens, ensuring seamless tracking and instant confirmation."

---

### Scene 3: Employer Journey — Job Posting & Candidate Review (04:30 – 07:30)

**What to show on screen:**
* Log out or open incognito, log in as Employer (`employer@test.com`).
* Click "Post a Job" (`/post-job` or `/freelance/post`).
* Fill out job title, category, salary, and requirements.
* Show the option for "Promoted / Featured Job" tier.
* Submit the form; show the newly posted job in the Employer Management tab.
* Show candidate application list: review an applicant, change status to "SHORTLISTED" or "INTERVIEW_SCHEDULED".

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "አሁን ደግሞ ወደ ቀጣሪው አካውንት ገብተናል። ቀጣሪው በቀላሉ አዲስ የስራ ማስታወቂያ ለመለጠፍ 'Post a Job' የሚለውን ይጫናል። ርዕሱን፣ መስፈርቱን እና የሚከፈለውን ደመወዝ አስገብቶ ማስታወቂያው በቴሌግራም ቻናልና በዋናው ገጽ አናት ላይ ጎልቶ እንዲወጣ (Promoted) ማድረግ ይችላል። ማስታወቂያው እንደወጣ፣ ቀጣሪው ያመለከቱትን እጩዎች ዝርዝር ያያል፤ የ AI ግምገማ ነጥባቸውን አይቶ ማጣራት ወይም ለቃለመጠይቅ መጥራት ይችላል።"

> **English:**  
> "Now we are authenticated as an Employer. From the employer workspace, posting a new role is straightforward: specify the title, responsibilities, salary range, and optional promotion boosts for Telegram channel broadcasts. Once published, employers can manage applicants from their dedicated pipeline, view match ratings, download resumes, and advance candidates from 'Under Review' to 'Shortlisted' or 'Interview Scheduled'."

---

### Scene 4: Freelance Marketplace & Escrow Milestones (07:30 – 10:30)

**What to show on screen:**
* Navigate to `/freelance`.
* Show project listings, budget ranges, and freelancer proposals.
* Click on a project with Escrow integration.
* Highlight the Escrow State badge: `HELD_IN_ESCROW` -> `WORK_SUBMITTED` -> `RELEASED`.
* Show the wallet balance or payment method selection (Chapa / Telebirr).

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "ይህ ደግሞ የፍሪላንስ እና የፕሮጀክት ስራዎች ማዕከል ነው። አሰሪዎች ፕሮጀክታቸውን ይለጥፋሉ፤ ፍሪላንሰሮች ፕሮፖዛል ያቀርባሉ። እዚህ ጋር በጣም አስፈላጊው ነገር የ Escrow ስርዓት ነው። ደንበኛው ክፍያውን ሲፈጽም ገንዘቡ በደህንነት በ Escrow ውስጥ ታግዶ ይቆያል እንጂ ወዲያውኑ አይለቀቅም። ፍሪላንሰሩ ስራውን ሰርቶ ሲያስረክብ እና ደንበኛው ሲያረጋግጥ ብቻ ክፍያው ወደ ፍሪላንሰሩ ዋሌት ይለቀቃል። ይህም ለሁለቱም ወገን መተማመንን ይፈጥራል።"

> **English:**  
> "Next is the Freelance Marketplace. Here, clients publish fixed-price or milestone-based contracts, and freelancers submit competitive proposals. A standout feature is our automated Escrow protection: when a project kicks off, client funds are locked securely in Escrow. Only after the freelancer submits deliverables and the client approves the work are the funds released to the freelancer's wallet, ensuring 100% financial protection for both parties."

---

### Scene 5: Central Admin Dashboard & Audit Operations (10:30 – 13:30)

**What to show on screen:**
* Navigate to Admin Panel (`http://localhost:3002` or `frontend/`).
* Show system analytics cards: Total Users, Active Jobs, Revenue, KYC Verifications, Fraud Flags.
* Navigate to "Users" table: Show role switching, account suspension, and 2FA status.
* Navigate to "Disputes / Escrow" manager: Show dispute resolution controls.
* Navigate to "Audit Logs": Show real-time admin action logging.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "በመጨረሻም የአጠቃላይ ሲስተሙን መቆጣጠሪያ የአድሚን ዳሽቦርድ እናያለን። እዚህ ዳሽቦርድ ላይ የሲስተሙ አጠቃላይ እንቅስቃሴ በቁጥር ይቀመጣል፡ ምን ያህል ተጠቃሚዎች አሉ፣ ስንት ክፍያዎች ተፈጽመዋል፣ እና ያጋጠሙ አጠራጣሪ ነገሮች (Fraud Flags) ካሉ ያሳውቃል። አድሚኑ ማንኛውንም ተጠቃሚ ማገድ፣ KYC ማረጋገጥ፣ በፍሪላንስ ውዝግብ ውስጥ ፍትሃዊ ውሳኔ መስጠት እና የኦዲት መዝገቦችን በቅጽበት መከታተል ይችላል።"

> **English:**  
> "Finally, let's look at the Central Admin Dashboard. This portal delivers complete operational oversight: platform metrics, active jobs, gross payment volume, KYC verifications, and automated fraud alerts. System administrators have full control to manage user roles, resolve freelance escrow disputes, approve employer verification documents, and audit all platform events with zero data loss."

---

### Scene 6: Video 3 Summary & Transition to Video 4 (13:30 – 14:30)

**What to show on screen:**
* Return to the main portal homepage showing responsive layout (mobile view toggle in DevTools).
* Display handover contact info or documentation link.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "በዚህ ቪዲዮ የ Beleqet Ecosystemን ዋና ዋና የፊት ገጾች፣ የስራ ፈላጊዎች እና የቀጣሪዎችን ጉዞ፣ የፍሪላንስ Escrow ስርዓትን እና የአድሚን ዳሽቦርድን ተመልክተናል። በሚቀጥለው የመጨረሻው ቪዲዮ ቁጥር 4 ላይ፣ የቴሌግራም ቦቶችን (Telegram Mini App, Channel Broadcast Bot እና Support Bot) እንዲሁም የሰርቨር አውቶሜሽኖችን በጥልቀት እናያለን። እናመሰግናለን!"

> **English:**  
> "In this video, we demonstrated the multi-portal frontend architecture, user workflows for candidates and employers, escrow milestone guarantees, and central administrative tools. In our fourth and final video, we will dive into the Telegram automation bots, Telegram Mini Apps, and automated background jobs. Thank you for watching!"

---
*Generated for Beleqet Ecosystem Technical Handover Series.*
