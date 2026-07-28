export interface ExtractedExperience {
    role: string;
    company: string;
    start: string;
    end: string;
    description: string;
}
export interface ExtractedEducation {
    school: string;
    qualification: string;
    year: string;
}
export interface ExtractedResume {
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
    education: ExtractedEducation[];
    experience: ExtractedExperience[];
}
export declare class ExtractedEducationDto implements ExtractedEducation {
    school: string;
    qualification: string;
    year: string;
}
export declare class ExtractedExperienceDto implements ExtractedExperience {
    role: string;
    company: string;
    start: string;
    end: string;
    description: string;
}
export declare class ExtractedResumeDto implements ExtractedResume {
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
    education: ExtractedEducationDto[];
    experience: ExtractedExperienceDto[];
}
export declare const EMPTY_EXTRACTED_RESUME: ExtractedResume;
