import type { PromptTemplate } from '../../prompt-template.interface';
import { SYSTEM_PROMPT } from '../../system.prompt';

const REQUIRED_VARIABLES = [
  'jobTitle',
  'jobDescription',
  'requiredSkills',
  'candidateTitle',
  'candidateBioSummary',
  'candidateSkills',
  'candidateExperienceYears',
  'candidatePastProjects',
] as const;

const userPrompt = `የሚከተለውን ነፃ አገልግሎት ሰራተኛ (ፍሪላንሰር) ከስራ ማስታወቂያው ጋር ይገምግሙ።

የስራ ማዕረግ፦ {{jobTitle}}

የስራ መግለጫ፦
{{jobDescription}}

የሚፈለጉ ክህሎቶች፦ {{requiredSkills}}

---
የእጩ መገለጫ
---

ማዕረግ፦ {{candidateTitle}}

የህይወት ታሪክ፦
{{candidateBioSummary}}

ክህሎቶች፦ {{candidateSkills}}
ልምድ፦ {{candidateExperienceYears}} ዓመታት

ያለፉ ፕሮጀክቶች፦
{{candidatePastProjects}}

---
የግምገማ መመሪያዎች
---

ይህ እጩ ከስራው ጋር ምን ያህል እንደሚመጣጠን ይተንትኑ። የሚከተሉትን ነጥቦች ግምት ውስጥ ያስገቡ፦
1. ክህሎታቸው ከሚፈለጉት ክህሎቶች ጋር የሚመሳሰሉ መሆን አለመሆኑን።
2. የሙያ ልምዳቸው አግባብነት ያለው መሆን አለመሆኑን።
3. ያለፉ ፕሮጀክቶቻቸው እንደ ችሎታ ማረጋገጫ።

ከዚያ ይመልሱ፦
- የተዛማጅ ውሳኔ፦ STRONG_MATCH፣ POTENTIAL_MATCH፣ WEAK_MATCH፣ ወይም NOT_A_MATCH።
- የመተማመን ደረጃ ከ0.0 እስከ 1.0 ድረስ።
- ዝርዝር ማመዛዘኛ ውሳኔዎን የሚያስረዳ።
- የክህሎት ክፍተቶች — እጩው የጎደለው የሚፈለጉ ክህሎቶች።
- ጥንካሬዎች — እጩው ከሚጠበቀው በላይ የሚበልጥባቸው ቦታዎች።`;

/**
 * Amharic-language evaluation prompt template.
 * Uses the same exact {{variables}} as the English version.
 */
export const amEvaluationPrompt: PromptTemplate = {
  systemPrompt: SYSTEM_PROMPT,
  userPrompt,
  requiredVariables: REQUIRED_VARIABLES,
} as const;
