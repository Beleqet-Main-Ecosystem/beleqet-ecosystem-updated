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
34. Quality Standard: ኮድዎ የ Global Scaling (i18n, GDPR, Multi-currency) መስፈርቶችን ማሟላት አለበት።

---

## 🌐 GraphQL API (High-Performance Turbo Integration)
This platform natively supports a highly optimized GraphQL API engineered to eliminate over-fetching and under-fetching.

### Key Capabilities
- **Endpoint**: `POST /api/v1/graphql`
- **DataLoaders**: Implements aggressive query batching (N+1 eradication) for relational data like `Company` and `Category`.
- **Global Scaling Readiness**: Inherits full i18n support, GDPR compliance, and multi-currency schemas directly from the Prisma domain layer.

### Enterprise Security
- **Query Complexity Limit**: Strict cap of `100` points per query to block malicious Denial of Service (DOS) scraping attacks.
- **Query Depth Limit**: Blocks highly-nested cyclic queries past a depth of `5`.
- **Authentication**: Reuses the core stateless Passport JWT strategy via `@UseGuards(GqlAuthGuard)`.

### Example Client Fetch (React Query + graphql-request)
```typescript
import { gql } from 'graphql-request';

export const GET_JOBS = gql`
  query {
    jobs(query: { limit: 10 }) {
      items {
        id
        title
        company { name }
      }
      total
    }
  }
`;
```