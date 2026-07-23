/**
 * Portfolio Builder — Master Profile type definitions.
 *
 * Single source of truth for future CV, resume, and AI modules.
 * Presentation (templates) is separate from this normalized data model.
 */

/** Supported UI/content locale codes. Extend the union to add languages. */
export type LanguageCode = "en" | "am";

/** Bilingual (extensible) text field used across the master profile. */
export type LocalizedText = Record<LanguageCode, string>;

/** Portfolio template identifiers — presentation only, not stored data shape. */
export type TemplateId = "modern" | "minimal" | "professional" | "creative";

/** Reorderable builder section identifiers. */
export type PortfolioSectionId =
  | "profile"
  | "summary"
  | "projects"
  | "caseStudies"
  | "skills"
  | "certifications"
  | "education"
  | "experience"
  | "socialLinks"
  | "gallery"
  | "contact";

export type SkillLevel = "beginner" | "intermediate" | "advanced" | "expert";

export type SkillCategory =
  | "frontend"
  | "backend"
  | "cloud"
  | "devops"
  | "security"
  | "design"
  | "languages"
  | "other";

/** Profile header block — maps to future master profile identity fields. */
export type ProfileBlock = {
  fullName: string;
  headline: LocalizedText;
  jobTitle: LocalizedText;
  avatarUrl: string;
  location: string;
};

export type PortfolioProject = {
  id: string;
  title: LocalizedText;
  description: LocalizedText;
  technologies: string[];
  images: string[];
  links: { label: string; url: string }[];
  githubUrl: string;
  liveDemoUrl: string;
  tags: string[];
  featured: boolean;
  orderIndex: number;
};

export type CaseStudy = {
  id: string;
  title: LocalizedText;
  problem: LocalizedText;
  solution: LocalizedText;
  approach: LocalizedText;
  results: LocalizedText;
  screenshots: string[];
  metrics: { label: string; value: string }[];
  orderIndex: number;
};

export type SkillItem = {
  id: string;
  name: LocalizedText;
  level: SkillLevel;
  yearsOfExperience: number;
  orderIndex: number;
};

export type SkillGroup = {
  id: string;
  category: SkillCategory;
  skills: SkillItem[];
  orderIndex: number;
};

export type Certification = {
  id: string;
  issuer: string;
  certificateName: LocalizedText;
  credentialUrl: string;
  issueDate: string;
  expiryDate: string;
  orderIndex: number;
};

export type EducationEntry = {
  id: string;
  institution: LocalizedText;
  degree: LocalizedText;
  field: LocalizedText;
  startYear: string;
  endYear: string;
  description: LocalizedText;
  orderIndex: number;
};

export type ExperienceEntry = {
  id: string;
  role: LocalizedText;
  company: LocalizedText;
  location: string;
  startDate: string;
  endDate: string;
  description: LocalizedText;
  orderIndex: number;
};

export type SocialLink = {
  id: string;
  platform: string;
  url: string;
  orderIndex: number;
};

export type GalleryItem = {
  id: string;
  title: LocalizedText;
  imageUrl: string;
  caption: LocalizedText;
  orderIndex: number;
};

export type ContactInfo = {
  email: string;
  phone: string;
  website: string;
  availability: LocalizedText;
};

/** Master Profile — normalized portfolio state (AI-ready, i18n-ready). */
export type MasterProfileData = {
  version: 1;
  templateId: TemplateId;
  industries: string[];
  sectionOrder: PortfolioSectionId[];
  profile: ProfileBlock;
  summary: LocalizedText;
  projects: PortfolioProject[];
  caseStudies: CaseStudy[];
  skills: SkillGroup[];
  certifications: Certification[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  socialLinks: SocialLink[];
  gallery: GalleryItem[];
  contact: ContactInfo;
  meta: {
    published: boolean;
    updatedAt: string;
  };
};

/** Actions that require authentication before persisting. */
export type PortfolioPersistAction = "save" | "export" | "publish";
