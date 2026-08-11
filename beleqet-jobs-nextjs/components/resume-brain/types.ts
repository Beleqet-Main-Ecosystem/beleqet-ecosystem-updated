/** A monetary amount paired with its ISO 4217 currency code — never a bare number. */
export interface MoneyValue {
  amount: string;
  currencyCode: string;
}

export interface PersonalInfo {
  fullName: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
}

export interface EducationEntry {
  institution: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
}

export interface WorkExperienceEntry {
  company: string | null;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
  compensation?: MoneyValue | null;
}

export interface LanguageEntry {
  language: string | null;
  proficiency: string | null;
}

/** Structured CV data extracted by Resume Brain, mirroring the backend's `ExtractedResumeDto`. */
export interface ExtractedResume {
  personalInfo: PersonalInfo;
  education: EducationEntry[];
  workExperience: WorkExperienceEntry[];
  skills: string[];
  certifications: string[];
  languages: LanguageEntry[];
}

export type ResumeUploadStatus = 'PENDING' | 'PARSING' | 'PARSED' | 'FAILED';

export interface ParsedResumeRecord extends ExtractedResume {
  id: string;
}

export interface ResumeUploadRecord {
  id: string;
  userId: string;
  originalFilename: string;
  status: ResumeUploadStatus;
  mimeType: string;
  fileSizeBytes: number;
  failureReason?: string | null;
  createdAt: string;
  parsedResume?: ParsedResumeRecord | null;
}

export interface UploadResumeResponse {
  upload: ResumeUploadRecord;
  parsedResume: ParsedResumeRecord;
}
