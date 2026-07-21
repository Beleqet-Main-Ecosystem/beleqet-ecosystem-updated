import type { TemplateId } from "../types";

export type TemplateMeta = {
  id: TemplateId;
  name: { en: string; am: string };
  description: { en: string; am: string };
  accent: string;
  previewClass: string;
};

/** Template catalog — presentation metadata only; data model stays unchanged on switch. */
export const PORTFOLIO_TEMPLATES: TemplateMeta[] = [
  {
    id: "modern",
    name: { en: "Modern", am: "ዘመናዊ" },
    description: {
      en: "Bold typography with vibrant accents.",
      am: "ደፋር ቃላት እና ለስላሳ ቀለሞች።",
    },
    accent: "bg-brandGreen",
    previewClass: "rounded-3xl shadow-card",
  },
  {
    id: "minimal",
    name: { en: "Minimal", am: "ቀለል" },
    description: {
      en: "Clean whitespace and subtle borders.",
      am: "ንጹህ ቦታ እና ቀላል መስመሮች።",
    },
    accent: "bg-primary",
    previewClass: "rounded-none border border-primary/10",
  },
  {
    id: "professional",
    name: { en: "Professional", am: "ሙያዊ" },
    description: {
      en: "Structured layout for corporate roles.",
      am: "ለኮርፖሬት ሚናዎች የተዋቀረ።",
    },
    accent: "bg-darkGreen",
    previewClass: "rounded-xl shadow-sm",
  },
  {
    id: "creative",
    name: { en: "Creative", am: "ፈጠራ" },
    description: {
      en: "Expressive gradients and gallery focus.",
      am: "ግራዲያንት እና ጋለሪ ትኩረት።",
    },
    accent: "bg-accentOrange",
    previewClass: "rounded-[2rem] shadow-lg",
  },
];

/** Resolves template metadata by id. */
export function getTemplateMeta(id: TemplateId): TemplateMeta {
  const found = PORTFOLIO_TEMPLATES.find((t) => t.id === id);
  return found ?? PORTFOLIO_TEMPLATES[0];
}
