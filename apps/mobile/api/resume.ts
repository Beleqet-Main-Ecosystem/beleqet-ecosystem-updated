/** Resume Brain: read a CV with AI, then fill the profile from it. Same calls as the website. */
import { send, upload, type PickedFile } from '../lib/api';

export type PersonalInfo = { fullName: string | null; email: string | null; phone: string | null; location: string | null };
export type ExtractedResume = {
  personalInfo: PersonalInfo;
  education: { institution: string | null; degree: string | null; fieldOfStudy: string | null; startDate: string | null; endDate: string | null }[];
  workExperience: { company: string | null; title: string | null; startDate: string | null; endDate: string | null; description: string | null }[];
  skills: string[];
  certifications: string[];
  languages: { language: string | null; proficiency: string | null }[];
};
export type UploadResumeResponse = {
  upload: { id: string; originalFilename: string; status: string };
  parsedResume: ExtractedResume & { id: string };
};

/** Uploads and reads a CV; `consent` is the person's agreement to have it processed. */
export const readResume = (file: PickedFile) => upload<UploadResumeResponse>('/resumes/upload', file, { consent: 'true' });
/** Deletes the stored file and what was read from it. */
export const deleteResume = (uploadId: string) => send('DELETE', `/resumes/${encodeURIComponent(uploadId)}`);
export const autofillProfile = (userId: string, resumeId: string, overrides: { personalInfo: PersonalInfo; skills: string[] }) =>
  send('PATCH', `/profiles/${encodeURIComponent(userId)}/autofill`, { resumeId, ...overrides });
