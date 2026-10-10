# Beleqet Ecosystem: Handover Video 4 — Telegram Bots, Mini Apps & Automation
## (የቴሌግራም ቦቶች፣ ሚኒ አፕስ እና የጀርባ አውቶሜሽኖች የተግባር መመሪያ ስክሪፕት)

**Audience:** DevOps Engineers, Backend Leads, Bot Administrators, Automation Engineers  
**Topic:** Video 4 — 3 Telegram Bots (Main/Jobs Bot, Channel Auto-Poster, FAQ/Support Bot), Telegram Mini App (TMA), BullMQ Background Queues, and Cron Jobs  
**Estimated Duration:** ~12 – 15 Minutes  
**Format:** Screen Recording + Voice Narration (Amharic & English for Every Scene)  

---

## 📋 Pre-Recording Setup Checklist (ከመቅረጽህ በፊት አዘጋጅ)

1. **Telegram Desktop / Web Open:**
   * Bot 1: Main Jobs Bot (`@beleqet_jobs_bot` or test handle)
   * Bot 2: Beleqet Official Broadcast Channel (where automated job alerts arrive)
   * Bot 3: Support / FAQ Bot (`@beleqet_support_bot`)
   * Test user chat ready to open the Telegram Mini App (TMA)

2. **Terminal Tab 1 (VPS SSH or Local):**
   * VPS Terminal ready showing systemd service status:
     ```bash
     sudo systemctl status beleqet-bot-main beleqet-bot-channel beleqet-bot-support --no-pager
     ```
   * Or showing logs:
     ```bash
     journalctl -u beleqet-bot-main -f -n 20
     ```

3. **VS Code Files Ready in Tabs:**
   * `src/modules/telegram/telegram-tma.service.ts` (TMA authentication & initData hash verification)
   * `src/modules/telegram/telegram-broadcast.service.ts` (Channel markdown formatting & automated push)
   * `src/modules/email-automation/email.processor.ts` (BullMQ async queue processing)
   * `src/modules/cron/` or scheduled tasks (Auto-expiry, digests)

---

## 🎬 Scene-by-Scene Recording Script

---

### Scene 1: Introduction & Telegram Ecosystem Architecture (00:00 – 01:45)

**What to show on screen:**
* Diagram or VS Code explorer showing Telegram modules in `src/modules/telegram/`.
* VPS terminal showing the 3 systemd bot services running actively in green:
  * `beleqet-bot-main.service`
  * `beleqet-bot-channel.service`
  * `beleqet-bot-support.service`

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "እንኳን ወደ የመጨረሻው የቪዲዮ ክፍል 4 በደህና መጡ! በኢትዮጵያ ገበያ ውስጥ ቴሌግራም እጅግ ተመራጭ የመገናኛ መንገድ በመሆኑ፣ የ Beleqet Ecosystem ሙሉ ለሙሉ ከቴሌግራም ጋር የተሳሰረ ነው። በዚህ ቪዲዮ ሶስቱን የቴሌግራም ቦቶች፣ የቴሌግራም ሚኒ አፕ (TMA) አሰራርን እና ከጀርባ የሚሰሩ የ BullMQ እና Cron አውቶሜሽኖችን እናያለን። በሰርቨራችን ላይ እንደምታዩት ሦስቱም ቦቶች በ systemd ሰርቪስ አማካኝነት 24/7 ያለማቋረጥ እየሰሩ ይገኛሉ።"

> **English:**  
> "Welcome to the fourth and final video of the Beleqet Handover Series! In Ethiopia and the broader region, Telegram is the primary digital communication hub. As such, the Beleqet Ecosystem features deep, native Telegram integrations. In this session, we will inspect our three autonomous Telegram bots, the Telegram Mini App (TMA), and background automation workers powered by BullMQ and Cron. As seen on our staging VPS, all three bots run 24/7 as monitored systemd services."

---

### Scene 2: Bot 1 — The Main Interactive Jobs Bot & Telegram Mini App (01:45 – 05:00)

**What to show on screen:**
* Open Telegram, open the Main Bot chat.
* Send `/start` command.
* Show language selection (Amharic / English / Afaan Oromoo).
* Click the inline button "📱 Open Beleqet App" (Telegram Mini App).
* Show the TMA webview slide up smoothly inside Telegram without leaving the app.
* Show how the candidate logs in automatically using Telegram `initData`.
* Show browsing jobs inside the TMA.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "የመጀመሪያው ዋናው ቦት ነው። ተጠቃሚው `/start` ሲል ቋንቋውን መርጦ ዋና ሜኑውን ያገኛል። በጣም አስደናቂው ባህሪ 'Open Beleqet App' ሲባል የሚከፈተው Telegram Mini App ነው። ተጠቃሚው ከቴሌግራም ሳይወጣ ሙሉውን የዌብሳይት አገልግሎት ማግኘት ይችላል። ባክኤንዳችን የቴሌግራምን `initData` በ cryptographically የተረጋገጠ Hash ፈትሾ ተጠቃሚውን ያለምንም የይለፍ ቃል በደህንነት ሎግኢን ያደርገዋል። እጩዎች በቴሌግራም ውስጥ ሆነው ስራ መፈለግ እና ማመልከት ይችላሉ።"

> **English:**  
> "Here is our flagship Interactive Jobs Bot. Sending `/start` presents locale selection and direct interactive actions. The crown jewel is our Telegram Mini App (TMA). Tapping 'Open Beleqet App' mounts the responsive client directly within Telegram. Our backend validates Telegram's cryptographic `initData` HMAC hash, establishing authenticated user sessions with zero password friction. Job seekers can browse, bookmark, and apply to opportunities without ever exiting Telegram."

---

### Scene 3: Bot 2 — Automated Telegram Channel Broadcast (05:00 – 08:00)

**What to show on screen:**
* Open the official Beleqet Telegram Broadcast Channel.
* Show posted job messages with formatted Markdown, hashtags, and direct application buttons.
* Switch to VS Code: Open `src/modules/telegram/telegram-broadcast.service.ts` or trigger a test broadcast via Swagger/API.
* Show the message arriving in the channel in real time!
* Show the inline button "👉 Apply Now" redirecting directly to the job.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "ሁለተኛው ቦት ለቴሌግራም ቻናል የተዘጋጀ ራስ-ሰር አብሳሪ (Channel Broadcast Bot) ነው። አዲስ የስራ ማስታወቂያ በዌብሳይቱ ላይ ሲለጠፍ ወይም ቀጣሪው Promoted ሲያደርገው፣ ቦቱ ወዲያውኑ ጽሁፉን በቴሌግራም ማርክዳውን አዘጋጅቶ፣ አስፈላጊ ሀሽታጎችን ጨምሮ ወደ ቻናሉ ይለጥፈዋል። እያንዳንዱ ፖስት 'Apply Now' የሚል አዝራር ስላለው ተከታዮች በቀጥታ ወደ ስራው ገጽ ይወሰዳሉ። ይህ አሰራር የቀጣሪዎችን የስራ ማስታወቂያ በሺዎች ለሚቆጠሩ ተከታዮች በሰከንድ ውስጥ ያደርሳል።"

> **English:**  
> "Our second bot is the Automated Channel Broadcast engine. Whenever an employer publishes a new role or buys a promotion boost, this bot compiles the job details, formats clean Telegram Markdown with relevant hashtags, and broadcasts it instantaneously to official Beleqet subscriber channels. Each broadcast includes an inline 'Apply Now' button that links straight to the application workflow, delivering maximum reach for recruiters."

---

### Scene 4: Bot 3 — 24/7 FAQ & Candidate Support Bot (08:00 – 10:30)

**What to show on screen:**
* Open the FAQ/Support Bot chat.
* Send common user questions:
  * "How do I upload my CV?"
  * "How does escrow work?"
  * "እንዴት ክፍያ መክፈል እችላለሁ?"
* Show instant answers in the chosen language.
* Show fallback option: "Talk to human agent / ቲኬት ክፈት".
* Show support ticket created in the database or admin portal.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "ሦስተኛው ቦት የ 24/7 የተጠቃሚዎች ረዳት ቦት (Support & FAQ Bot) ነው። ተጠቃሚዎች ስለ ሲቪ አጫጫን፣ ስለ ክፍያ መንገዶች ወይም ስለ ፍሪላንስ Escrow ሲጠይቁ ወዲያውኑ በአማርኛ ወይም በእንግሊዝኛ ምላሽ ይሰጣል። ተጠቃሚው ተጨማሪ እርዳታ ከፈለገ 'Contact Agent' የሚለውን በመጫን የድጋፍ ቲኬት መክፈት ይችላል። ይህ የአድሚን ሰራተኞችን ድካም በከፍተኛ ሁኔታ ይቀንሳል።"

> **English:**  
> "Our third bot provides 24/7 automated support and FAQ assistance. Candidates and employers can ask questions regarding application status, payment channels, or freelance escrow policies in Amharic or English, receiving instant resolution. If automated guidance is insufficient, users can trigger 'Escalate to Support Agent', which opens a tracked ticket directly in our admin portal."

---

### Scene 5: Background Queues (BullMQ) & Scheduled Cron Jobs (10:30 – 13:00)

**What to show on screen:**
* Open VS Code: `src/modules/email-automation/email.processor.ts` & queue module.
* Terminal: Show Redis queue status using `redis-cli ping` or inspect Redis keys (`beleqet:bull:*`).
* Explain the automated tasks:
  * Email Dispatch Queue (welcome emails, interview invitations, password resets).
  * Expired Job Auto-Archiver (runs nightly via Cron).
  * Candidate Match Digest (matches new jobs to candidate profiles).
  * Escrow Auto-Release Timer (releases funds if client is inactive after deliverable review period).

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "አሁን ደግሞ ከጀርባ ስለሚሰሩ አውቶሜሽኖች እንነጋገር። ሲስተማችን ፈጣን እንዲሆን ማንኛውም ጊዜ የሚወስድ ስራ (ለምሳሌ ኢሜይል መላክ ወይም ማስታወቂያ ማሰራጨት) በ BullMQ እና Redis አማካኝነት ወረፋ (Queue) ተሰጥቶት ከጀርባ ይሰራል፤ ተጠቃሚው ፍጥነት አይጓተትበትም። በተጨማሪም በየቀኑ ማታ የሚሰሩ Cron Jobs አሉ፡ ጊዜያቸው ያለፈባቸውን ስራዎች ማቆም፣ አዲስ ስራዎችን ለእጩዎች በኢሜይል መላክ፣ እና ደንበኛው ሳይመልስ የዘገየበትን የ Escrow ክፍያ በራስ-ሰር መልቀቅን ያከናውናሉ።"

> **English:**  
> "Let's examine the background automation architecture. To maintain sub-second API response times, heavy operations such as transactional email dispatching and multi-channel notifications are decoupled using Redis-backed BullMQ queues. In addition, scheduled Cron tasks run autonomously: auto-archiving expired listings, calculating nightly candidate recommendation digests, and enforcing escrow auto-release deadlines if a client becomes unresponsive after deliverables are submitted."

---

### Scene 6: Complete Series Conclusion & Handover Sign-off (13:00 – 14:30)

**What to show on screen:**
* Open the complete project root showing all 4 scripts:
  * `VIDEO-1-ARCHITECTURE-AND-SETUP-SCRIPT.md`
  * `VIDEO-2-BACKEND-MODULES-AND-TESTING-SCRIPT.md`
  * `VIDEO-3-FRONTEND-AND-USER-FLOWS-SCRIPT.md`
  * `VIDEO-4-TELEGRAM-BOTS-AND-AUTOMATION-SCRIPT.md`
* Display healthy production/staging verification stats.

**Voiceover Script:**

> **አማርኛ (Amharic):**  
> "በዚህም የ 4ቱን ተከታታይ የ Beleqet Ecosystem የቴክኒካል ርክክብ ቪዲዮዎችን አጠናቀናል! አርክቴክቸሩን፣ 60ውን የባክኤንድ ሞጁሎች እና ቴስቶችን፣ ሁሉንም የፊት ለፊት ፖርታሎች፣ እና ቴሌግራም ቦቶችን ሙሉ በሙሉ ተመልክተናል። ሲስተሙ በአስተማማኝ ሁኔታ የተገነባ፣ ሙሉ በሙሉ የተፈተሸ እና ለቀጣይ እድገት ዝግጁ ነው። ስለተከታተላችሁ እናመሰግናለን!"

> **English:**  
> "This concludes our comprehensive four-part Beleqet Ecosystem Technical Handover Series! We have covered the infrastructure and database schemas, the 60 backend domain modules and test suites, all user-facing frontends and portals, and native Telegram bots with background automation. The ecosystem is hardened, fully verified, and ready for scale. Thank you for your partnership, and happy deploying!"

---
*Generated for Beleqet Ecosystem Technical Handover Series.*
