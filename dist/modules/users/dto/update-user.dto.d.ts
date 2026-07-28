export declare class SaveCvDraftDto {
    data: Record<string, unknown>;
}
export declare class UpdateUserDto {
    firstName?: string;
    lastName?: string;
    phone?: string;
    avatarUrl?: string;
    telegramId?: string;
    headline?: string;
    bio?: string;
    location?: string;
    defaultResumeUrl?: string;
    portfolioUrl?: string;
    githubUrl?: string;
    linkedinUrl?: string;
    skills?: string[];
}
export declare class CreateCompanyDto {
    name: string;
    description?: string;
    logoUrl?: string;
    website?: string;
    industry?: string;
    size?: string;
    location?: string;
    linkedinUrl?: string;
    twitterUrl?: string;
    facebookUrl?: string;
    coverImageUrl?: string;
    benefits?: string[];
    foundedYear?: number;
}
