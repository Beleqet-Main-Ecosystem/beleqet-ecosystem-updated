import { PrismaService } from '../../prisma/prisma.service';
interface FeedJob {
    id: string;
    title: string;
    description: string;
    tags: string[];
    categoryId: string;
    salaryMin: number | null;
    salaryMax: number | null;
    currency: string;
    createdAt: Date;
    company: {
        id: string;
        name: string;
    } | null;
    category: {
        id: string;
        slug: string;
        label: string;
    } | null;
}
export type PersonalizedJob = FeedJob & {
    relevanceScore: number;
};
export declare class AiFeedService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    getPersonalizedFeed(userId: string, limit?: number): Promise<PersonalizedJob[]>;
    private fetchCandidatePool;
    private buildKeywordFilter;
    private getRecentSearchTerms;
    private getSavedJobCategoryIds;
    private getGenericFeed;
    private rankJobs;
    private scoreJob;
    private tokenize;
    private extractKeywords;
}
export {};
