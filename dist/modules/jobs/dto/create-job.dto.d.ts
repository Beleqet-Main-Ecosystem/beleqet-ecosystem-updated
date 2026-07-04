export declare enum JobType {
    FULL_TIME = "FULL_TIME",
    PART_TIME = "PART_TIME",
    REMOTE = "REMOTE",
    HYBRID = "HYBRID",
    CONTRACT = "CONTRACT"
}
export declare enum JobStatus {
    DRAFT = "DRAFT",
    PUBLISHED = "PUBLISHED",
    CLOSED = "CLOSED"
}
export declare class CreateJobDto {
    title: string;
    description: string;
    requirements?: string;
    location: string;
    type: JobType;
    categoryId: string;
    salaryMin?: number;
    salaryMax?: number;
    deadline?: string;
    featured?: boolean;
    tags?: string[];
    filled?: boolean;
    urgent?: boolean;
    jobSite?: string;
    gender?: string;
    salaryType?: string;
    vacancies?: number;
    experienceLevel?: string;
    yearsOfExperience?: string;
    qualification?: string;
    expiryDate?: string;
    applyType?: string;
    applyUrl?: string;
    applyEmail?: string;
    contactPhone?: string;
    companyName?: string;
    companyLogo?: string;
    status?: JobStatus;
    currency?: string;
}
export declare class QueryJobsDto {
    q?: string;
    category?: string;
    location?: string;
    type?: JobType;
    page?: number;
    limit?: number;
}
