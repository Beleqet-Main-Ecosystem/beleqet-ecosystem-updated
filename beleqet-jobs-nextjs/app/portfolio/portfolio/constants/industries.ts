/**
 * Reusable industry taxonomy for master profile tagging.
 * Supports multi-select; designed for future AI skill recommendations.
 */

export const INDUSTRY_TAXONOMY = [
  "banking",
  "finance",
  "ngo",
  "development",
  "technology",
  "telecom",
  "healthcare",
  "education",
  "construction",
  "manufacturing",
  "fresh_graduate",
] as const;

export type IndustryTag = (typeof INDUSTRY_TAXONOMY)[number];

/** Human-readable labels keyed by taxonomy id. */
export const INDUSTRY_LABELS: Record<IndustryTag, { en: string; am: string }> = {
  banking: { en: "Banking", am: "ባንክ" },
  finance: { en: "Finance", am: "ፋይናንስ" },
  ngo: { en: "NGO", am: "መንግሥት ያልሆነ ድርጅት" },
  development: { en: "Development", am: "ልማት" },
  technology: { en: "Technology", am: "ቴክኖሎጂ" },
  telecom: { en: "Telecom", am: "ቴሌኮም" },
  healthcare: { en: "Healthcare", am: "ጤና" },
  education: { en: "Education", am: "ትምህርት" },
  construction: { en: "Construction", am: "ግንባታ" },
  manufacturing: { en: "Manufacturing", am: "ማኑፋክቸሪንግ" },
  fresh_graduate: { en: "Fresh Graduate", am: "አዲስ ተመራቂ" },
};
