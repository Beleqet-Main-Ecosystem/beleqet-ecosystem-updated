import { DEFAULT_SECTION_ORDER } from "../constants/sections";
import type { MasterProfileData } from "../types";
import { createId } from "../utils/ids";
import { emptyLocalized } from "../utils/localized";

/**
 * Returns a fresh master profile with sensible defaults for the builder.
 * Designed as the single normalized source for future CV/resume/AI modules.
 */
export function createEmptyPortfolio(): MasterProfileData {
  const now = new Date().toISOString();
  return {
    version: 1,
    templateId: "modern",
    industries: [],
    sectionOrder: [...DEFAULT_SECTION_ORDER],
    profile: {
      fullName: "",
      headline: emptyLocalized(),
      jobTitle: emptyLocalized(),
      avatarUrl: "",
      location: "",
    },
    summary: emptyLocalized(),
    projects: [],
    caseStudies: [],
    skills: [
      {
        id: createId("skill_group"),
        category: "frontend",
        orderIndex: 0,
        skills: [],
      },
    ],
    certifications: [],
    education: [],
    experience: [],
    socialLinks: [],
    gallery: [],
    contact: {
      email: "",
      phone: "",
      website: "",
      availability: emptyLocalized(),
    },
    meta: {
      published: false,
      updatedAt: now,
    },
  };
}

/**
 * Parses persisted JSON into master profile data with version guard.
 *
 * @param raw - Unknown JSON from API or localStorage.
 */
export function parsePortfolioData(raw: unknown): MasterProfileData | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Partial<MasterProfileData>;
  if (data.version !== 1 || !data.profile || !data.sectionOrder) return null;
  return data as MasterProfileData;
}

/**
 * Returns a new portfolio object with an updated timestamp.
 *
 * @param data - Current master profile.
 */
export function touchPortfolio(data: MasterProfileData): MasterProfileData {
  return {
    ...data,
    meta: { ...data.meta, updatedAt: new Date().toISOString() },
  };
}

/**
 * Switches presentation template without mutating content fields.
 *
 * @param data - Current master profile.
 * @param templateId - Target template id.
 */
export function switchTemplate(
  data: MasterProfileData,
  templateId: MasterProfileData["templateId"],
): MasterProfileData {
  return touchPortfolio({ ...data, templateId });
}
