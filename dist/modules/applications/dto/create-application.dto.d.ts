export declare class CreateApplicationDto {
    jobId: string;
    coverLetter?: string;
    resumeUrl?: string;
    screeningAnswers?: Record<string, any>;
    portfolioUrl?: string;
    expectedSalary?: number;
}
export declare enum ApplicationStatus {
    SUBMITTED = "SUBMITTED",
    SCREENING = "SCREENING",
    SHORTLISTED = "SHORTLISTED",
    INTERVIEW_SCHEDULED = "INTERVIEW_SCHEDULED",
    OFFERED = "OFFERED",
    REJECTED = "REJECTED",
    WITHDRAWN = "WITHDRAWN"
}
export declare class UpdateApplicationStatusDto {
    status: ApplicationStatus;
}
