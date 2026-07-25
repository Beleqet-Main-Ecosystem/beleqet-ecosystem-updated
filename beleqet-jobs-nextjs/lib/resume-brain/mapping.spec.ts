// Jest unit tests for the Resume Brain frontend mapping logic.
//
// These cover the pure, framework-free core of the CV Builder autofill:
//   - buildProfilePayload  → CV form mapped onto UpdateUserDto
//   - mergeExtractedProfile → AI profile merged into form + ✦AI field tracking
//   - extractErrorMessage  → backend HTTP status → user-facing copy
//
// Run with: npm run jest

import {
  buildProfilePayload,
  emptyCv,
  extractErrorMessage,
  mergeExtractedProfile,
  type CvData,
  type ExtractedProfile,
} from "./mapping";

function makeCv(overrides: Partial<CvData> = {}): CvData {
  return { ...emptyCv, ...overrides };
}

function makeProfile(overrides: Partial<ExtractedProfile> = {}): ExtractedProfile {
  return {
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    summary: "",
    headline: "",
    location: "",
    skills: [],
    languages: [],
    certifications: [],
    education: [],
    experience: [],
    ...overrides,
  };
}

describe("buildProfilePayload", () => {
  it("maps a full CV onto the UpdateUserDto fields", () => {
    const cv = makeCv({
      fullName: "Henok Mekonnen",
      title: "Senior Product Designer",
      phone: "+251 911 234 567",
      summary: "Results-driven designer.",
      location: "Addis Ababa, Ethiopia",
      skills: "Figma, Research, Prototyping",
    });

    expect(buildProfilePayload(cv)).toEqual({
      firstName: "Henok",
      lastName: "Mekonnen",
      phone: "+251 911 234 567",
      headline: "Senior Product Designer",
      bio: "Results-driven designer.",
      location: "Addis Ababa, Ethiopia",
      skills: ["Figma", "Research", "Prototyping"],
    });
  });

  it("splits fullName into first name and multi-word last name", () => {
    const payload = buildProfilePayload(makeCv({ fullName: "Ana Maria De La Cruz" }));
    expect(payload.firstName).toBe("Ana");
    expect(payload.lastName).toBe("Maria De La Cruz");
  });

  it("omits empty fields so a partial CV never blanks existing profile data", () => {
    const payload = buildProfilePayload(makeCv({ fullName: "Solo" }));
    expect(payload).toEqual({ firstName: "Solo" });
    expect(payload).not.toHaveProperty("lastName");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("bio");
  });

  it("NEVER maps email — sensitive fields stay off the AI write path (GDPR)", () => {
    const cv = makeCv({
      fullName: "Henok Mekonnen",
      email: "henok@example.com",
    });
    expect(buildProfilePayload(cv)).not.toHaveProperty("email");
  });

  it("returns an empty payload for an all-empty CV", () => {
    expect(buildProfilePayload(emptyCv)).toEqual({});
  });

  it("trims whitespace and drops empty skill entries", () => {
    const cv = makeCv({ skills: "  Figma , , Research ,, " , phone: "  123  " });
    const payload = buildProfilePayload(cv);
    expect(payload.skills).toEqual(["Figma", "Research"]);
    expect(payload.phone).toBe("123");
  });

  it("ignores a whitespace-only fullName", () => {
    const payload = buildProfilePayload(makeCv({ fullName: "   " }));
    expect(payload).not.toHaveProperty("firstName");
    expect(payload).not.toHaveProperty("lastName");
  });
});

describe("mergeExtractedProfile", () => {
  it("merges scalar fields and reports them as AI-filled", () => {
    const profile = makeProfile({
      firstName: "Sara",
      lastName: "Tesfaye",
      headline: "Backend Engineer",
      email: "sara@example.com",
      phone: "0911000000",
      location: "Addis Ababa",
      summary: "Node.js engineer.",
    });

    const { next, filled } = mergeExtractedProfile(emptyCv, profile);

    expect(next.fullName).toBe("Sara Tesfaye");
    expect(next.title).toBe("Backend Engineer");
    expect(next.email).toBe("sara@example.com");
    expect(next.phone).toBe("0911000000");
    expect(next.location).toBe("Addis Ababa");
    expect(next.summary).toBe("Node.js engineer.");

    expect(filled.has("fullName")).toBe(true);
    expect(filled.has("title")).toBe(true);
    expect(filled.has("email")).toBe(true);
    expect(filled.has("summary")).toBe(true);
  });

  it("joins skills and languages arrays into comma-separated strings", () => {
    const profile = makeProfile({
      skills: ["React", "TypeScript", "CSS"],
      languages: ["Amharic", "English"],
    });
    const { next, filled } = mergeExtractedProfile(emptyCv, profile);
    expect(next.skills).toBe("React, TypeScript, CSS");
    expect(next.languages).toBe("Amharic, English");
    expect(filled.has("skills")).toBe(true);
    expect(filled.has("languages")).toBe(true);
  });

  it("maps experience rows with deterministic ids from the seed", () => {
    const profile = makeProfile({
      experience: [
        { role: "Dev", company: "Acme", start: "2020", end: "2022", description: "Built things" },
        { role: "Lead", company: "Globex", start: "2022", end: "Present", description: "Led things" },
      ],
    });
    const { next, filled } = mergeExtractedProfile(emptyCv, profile, 5000);
    expect(next.experience).toHaveLength(2);
    expect(next.experience[0]).toMatchObject({ id: 5000, role: "Dev", company: "Acme" });
    expect(next.experience[1]).toMatchObject({ id: 5001, role: "Lead", company: "Globex" });
    expect(filled.has("experience")).toBe(true);
  });

  it("maps education rows with a separate id offset so ids never collide with experience", () => {
    const profile = makeProfile({
      experience: [
        { role: "Dev", company: "Acme", start: "2020", end: "2022", description: "" },
      ],
      education: [
        { school: "AAU", qualification: "BSc CS", year: "2019" },
      ],
    });
    const { next } = mergeExtractedProfile(emptyCv, profile, 5000);
    expect(next.experience[0].id).toBe(5000);
    expect(next.education[0].id).toBe(6000);
    expect(next.education[0]).toMatchObject({ school: "AAU", qualification: "BSc CS", year: "2019" });
  });

  it("leaves untouched fields empty and out of the filled set", () => {
    const { next, filled } = mergeExtractedProfile(
      emptyCv,
      makeProfile({ firstName: "Only", lastName: "Name" }),
    );
    expect(next.summary).toBe("");
    expect(filled.has("summary")).toBe(false);
    expect(filled.has("skills")).toBe(false);
  });

  it("does not mutate the original CvData (returns a new object)", () => {
    const original = makeCv({ summary: "keep me" });
    const snapshot = JSON.parse(JSON.stringify(original));
    mergeExtractedProfile(original, makeProfile({ firstName: "New" }));
    expect(original).toEqual(snapshot);
  });

  it("returns the original CV and an empty set for a null profile", () => {
    const { next, filled } = mergeExtractedProfile(emptyCv, null);
    expect(next).toBe(emptyCv);
    expect(filled.size).toBe(0);
  });

  it("ignores empty skill/experience arrays (no spurious AI badges)", () => {
    const { filled } = mergeExtractedProfile(
      emptyCv,
      makeProfile({ skills: [], experience: [] }),
    );
    expect(filled.has("skills")).toBe(false);
    expect(filled.has("experience")).toBe(false);
  });
});

describe("extractErrorMessage", () => {
  it.each([
    [400, "That file didn't look like a resume. Please try another file."],
    [413, "That file is too large (max 5 MB)."],
    [415, "Unsupported file type. Please upload a PDF or DOCX."],
    [
      422,
      "We couldn't read text from that file. Scanned or image-only resumes aren't supported.",
    ],
    [429, "The AI is busy right now. Please try again in a moment."],
    [503, "Resume AI is temporarily unavailable. Please try again later."],
  ])("maps status %i to its user-facing message", (status, expected) => {
    expect(extractErrorMessage(status as number, {})).toBe(expected);
  });

  it("falls back to the backend message for unmapped statuses", () => {
    expect(extractErrorMessage(418, { message: "I'm a teapot" })).toBe("I'm a teapot");
  });

  it("uses a generic fallback when no backend message is present", () => {
    expect(extractErrorMessage(500, {})).toBe("Could not read that resume.");
  });
});
