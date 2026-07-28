export declare enum PlagiarismContentType {
    JOB_DESCRIPTION = "JOB_DESCRIPTION",
    FREELANCE_JOB = "FREELANCE_JOB",
    COVER_LETTER = "COVER_LETTER",
    PROFILE = "PROFILE",
    COMPANY_PROFILE = "COMPANY_PROFILE",
    DELIVERABLE = "DELIVERABLE",
    OTHER = "OTHER"
}
export declare class CheckPlagiarismDto {
    text: string;
    contentType?: PlagiarismContentType;
    excludeEntityId?: string;
    sourceUrls?: string[];
    threshold?: number;
}
