// Resume Brain — pure, framework-free mapping logic.
//
// This module holds the parts of the CV Builder that have nothing to do with
// React: turning the AI's extracted profile into form state, mapping the form
// onto the existing UpdateUserDto, and translating backend HTTP errors into
// user-facing copy. Keeping it separate from `page.tsx` follows SRP and lets it
// be unit-tested in isolation (see mapping.spec.ts).

export type Experience = {
  id: number;
  role: string;
  company: string;
  start: string;
  end: string;
  description: string;
};

export type Education = {
  id: number;
  school: string;
  qualification: string;
  year: string;
};

export type CvData = {
  fullName: string;
  title: string;
  email: string;
  phone: string;
  location: string;
  website: string;
  summary: string;
  skills: string;
  languages: string;
  experience: Experience[];
  education: Education[];
};

// Shape returned by POST /resume-brain/extract (`profile`). Mirrors the
// backend ExtractedResume contract so the autofill maps field-for-field.
export type ExtractedProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  summary: string;
  headline: string;
  location: string;
  skills: string[];
  languages: string[];
  certifications: string[];
  education: { school: string; qualification: string; year: string }[];
  experience: {
    role: string;
    company: string;
    start: string;
    end: string;
    description: string;
  }[];
};

export const emptyCv: CvData = {
  fullName: "",
  title: "",
  email: "",
  phone: "",
  location: "",
  website: "",
  summary: "",
  skills: "",
  languages: "",
  experience: [
    { id: 1, role: "", company: "", start: "", end: "", description: "" },
  ],
  education: [{ id: 1, school: "", qualification: "", year: "" }],
};

// Map the (possibly edited) CV form onto UpdateUserDto. Only non-empty fields
// are included so a partial CV never blanks data already on the profile.
// Note: `email` is intentionally NOT mapped — sensitive fields stay off the
// AI-driven write path (GDPR), matching the backend ProfileMapper.
export function buildProfilePayload(cv: CvData): Record<string, unknown> {
  const [firstName, ...rest] = cv.fullName.trim().split(/\s+/);
  const skills = cv.skills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const payload: Record<string, unknown> = {};
  if (firstName) payload.firstName = firstName;
  if (rest.length) payload.lastName = rest.join(" ");
  if (cv.phone.trim()) payload.phone = cv.phone.trim();
  if (cv.title.trim()) payload.headline = cv.title.trim();
  if (cv.summary.trim()) payload.bio = cv.summary.trim();
  if (cv.location.trim()) payload.location = cv.location.trim();
  if (skills.length) payload.skills = skills;
  return payload;
}

// Merge the AI's structured profile into the form and report which fields it
// touched so the UI can highlight them for review. Pure: returns the next
// CvData and the set of filled field keys instead of mutating React state.
//
// `idSeed` seeds the generated ids for experience/education rows. It defaults to
// Date.now() to preserve the original behavior, but tests can pass a fixed seed
// for deterministic assertions.
export function mergeExtractedProfile(
  old: CvData,
  profile: ExtractedProfile | null | undefined,
  idSeed: number = Date.now(),
): { next: CvData; filled: Set<string> } {
  const filled = new Set<string>();
  if (!profile) return { next: old, filled };

  const fullName = [profile.firstName, profile.lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  const next: CvData = { ...old };
  if (fullName) (next.fullName = fullName), filled.add("fullName");
  if (profile.headline) (next.title = profile.headline), filled.add("title");
  if (profile.email) (next.email = profile.email), filled.add("email");
  if (profile.phone) (next.phone = profile.phone), filled.add("phone");
  if (profile.location)
    (next.location = profile.location), filled.add("location");
  if (profile.summary) (next.summary = profile.summary), filled.add("summary");
  if (profile.skills?.length)
    (next.skills = profile.skills.join(", ")), filled.add("skills");
  if (profile.languages?.length)
    (next.languages = profile.languages.join(", ")), filled.add("languages");
  if (profile.experience?.length) {
    next.experience = profile.experience.map((x, i) => ({
      id: idSeed + i,
      role: x.role,
      company: x.company,
      start: x.start,
      end: x.end,
      description: x.description,
    }));
    filled.add("experience");
  }
  if (profile.education?.length) {
    next.education = profile.education.map((x, i) => ({
      id: idSeed + 1000 + i,
      school: x.school,
      qualification: x.qualification,
      year: x.year,
    }));
    filled.add("education");
  }

  return { next, filled };
}

// Translate a backend HTTP status into user-facing copy for the upload flow.
export function extractErrorMessage(
  status: number,
  data: { message?: string },
): string {
  switch (status) {
    case 400:
      return "That file didn't look like a resume. Please try another file.";
    case 413:
      return "That file is too large (max 5 MB).";
    case 415:
      return "Unsupported file type. Please upload a PDF or DOCX.";
    case 422:
      return "We couldn't read text from that file. Scanned or image-only resumes aren't supported.";
    case 429:
      return "The AI is busy right now. Please try again in a moment.";
    case 503:
      return "Resume AI is temporarily unavailable. Please try again later.";
    default:
      return data?.message || "Could not read that resume.";
  }
}
