import type { PortfolioSectionId } from "../types";

/** Default section order for the builder sidebar and preview. */
export const DEFAULT_SECTION_ORDER: PortfolioSectionId[] = [
  "profile",
  "summary",
  "projects",
  "caseStudies",
  "skills",
  "certifications",
  "education",
  "experience",
  "socialLinks",
  "gallery",
  "contact",
];

/** UI labels for builder sections (i18n-ready keys). */
export const SECTION_LABELS: Record<
  PortfolioSectionId,
  { en: string; am: string }
> = {
  profile: { en: "Profile", am: "መገለጫ" },
  summary: { en: "Professional Summary", am: "ሙያዊ ማጠቃለያ" },
  projects: { en: "Projects", am: "ፕሮጀክቶች" },
  caseStudies: { en: "Case Studies", am: "ጥናታዊ ምሳሌዎች" },
  skills: { en: "Skills", am: "ክህሎቶች" },
  certifications: { en: "Certifications", am: "ምስክር ወረቀቶች" },
  education: { en: "Education", am: "ትምህርት" },
  experience: { en: "Experience", am: "ልምድ" },
  socialLinks: { en: "Social Links", am: "ሶሻል ሊንኮች" },
  gallery: { en: "Portfolio Gallery", am: "የፖርትፎሊዮ ጋለሪ" },
  contact: { en: "Contact", am: "አግኙን" },
};
