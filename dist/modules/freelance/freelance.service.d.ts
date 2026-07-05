import { PrismaService } from '../../prisma/prisma.service';
export declare class CreateFreelanceJobDto {
    title: string;
    description: string;
    categoryId: string;
    budgetMin: number;
    budgetMax: number;
    pricingType?: string;
    deadlineDays: number;
    skills: string[];
    locationPreference?: string;
    experienceLevel?: string;
    attachments?: string[];
}
export declare class CreateBidDto {
    amount: number;
    timelineDays: number;
    coverLetter: string;
}
export declare class CreateMilestoneDto {
    title: string;
    description?: string;
    amount: number;
    deadline: string;
}
export declare class FreelanceService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    createJob(clientId: string, dto: CreateFreelanceJobDto): Promise<any>;
    findJobs(query: {
        q?: string;
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findJobById(id: string): Promise<any>;
    submitBid(freelancerId: string, gigId: string, dto: CreateBidDto): Promise<any>;
    acceptBid(bidId: string, clientId: string): Promise<any>;
    rejectBid(bidId: string, clientId: string): Promise<any>;
    getMyBids(freelancerId: string): Promise<any>;
    getMyContracts(userId: string): Promise<any>;
    getContract(id: string): Promise<any>;
    createMilestone(freelancerId: string, contractId: string, dto: CreateMilestoneDto): Promise<any>;
}
