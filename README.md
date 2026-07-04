# Beleqet Global Freelance Ecosystem

እንኳን ወደ በልቀት (Beleqet) የቴክኖሎጂ ስነ-ምህዳር በደህና መጡ! ይህ መድረክ ከአገር ውስጥ አልፎ ዓለም አቀፍ ደረጃ ያለው የፍሪላንስ ስራዎችን የሚያገናኝ ሱፐር-ፕላትፎርም ነው።

## 🚀 የፕሮጀክት ግብ
የእኛ ዓላማ የላቀ ቴክኖሎጂን (AI, Scalability, Security) በመጠቀም የሥራ ፈጣሪዎችን እና ባለሙያዎችን በብቃት ማገናኘት ነው።

## 🛠 የልማት ደረጃዎች (Contribution Modules)
አመልካቾች ለፕሮጀክቱ በሚሰጡት ልዩ ምደባ መሰረት የተመደበላቸውን ሞጁል ብቻ በመስራት መሳተፍ ይችላሉ።

## 📋 የልማት እና የጥራት መመሪያ (Development Standards & Rules)
ማንኛውም የተላከ ኮድ ተቀባይነት እንዲያገኝ የሚከተሉትን ህጎች ማሟላት አለበት። እነዚህን ህጎች ያላሟላ ኮድ አይዋሃድም (Will not be merged)**።

1. **Modular Architecture:
   - ኮዱ የግድ NestJS Module መሆን አለበት። ማንኛውም ፊቸር ከሌላው ጋር በ Dependency Injection መያያዝ አለበት።
2. Clean Code & Naming Convention:
   - ሁሉም ቫሪያብሎች እና ፋይሎች ግልጽ ስም ሊኖራቸው ይገባል። camelCase ለቫሪያብሎች፣ PascalCase ለክፍሎች (Classes) መጠቀም ግዴታ ነው።
3. Data Security & Validation:
   - ማንኛውም የኢንፑት መረጃ በ class-validator አማካኝነት መረጋገጥ አለበት። ሚስጥራዊ መረጃ (API Keys, Passwords) በኮድ ውስጥ መኖር የተከለከለ ነው (Environment Variables ብቻ ይጠቀሙ)።
4. TypeScript Strict Mode:
   - ሁሉም ኮድ በ TypeScript መሆን አለበት። any የሚለውን ታይፕ (type) መጠቀም ሙሉ በሙሉ የተከለከለ ነው።
5. Documentation:
   - የሰራኸው እያንዳንዱ ፈንክሽን ምን እንደሚሰራ በ TSDoc (ኮድ ውስጥ አስተያየት) መጻፍ አለበት።
6. Testing Requirement:
   - ለሰራኸው እያንዳንዱ ሞጁል ቢያንስ አንድ Unit Test በ Jest መኖር አለበት።

---

## 🚀 እንዴት መሳተፍ ይቻላል?
1. Fork: ሪፖዚቶሪውን ፎርክ ያድርጉ።
2. Branch: በ feat/ ስር የእርስዎን ስም የያዘ አዲስ ብራንች ይክፈቱ (ምሳሌ፡ feat/assigned-task-name)።
3. Develop: የተመደቡትን ሞጁል ብቻ በንጹህ ኮድ ይስሩ።
4. Submit: ስራዎን ሲያጠናቅቁ የ GitHub Pull Request (PR) ይክፈቱ።
5. Quality Standard: ኮድዎ የ Global Scaling (i18n, GDPR, Multi-currency) መስፈርቶችን ማሟላት አለበት።

## 🌓 Contributed Module: Dark/Light Mode (User Experience & UI)

A frontend Dark/Light Mode module has been added under (./frontend).
This repository was NestJS-only prior to this contribution, so a minimal
Next.js host app was added solely to run and demonstrate the module — no
backend code was modified. See (./frontend/README.md)
for setup instructions and a rule-by-rule note on how each project
guideline was applied to a frontend-only module.


