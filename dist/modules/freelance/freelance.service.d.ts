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
    createJob(clientId: string, dto: CreateFreelanceJobDto): Promise<{
        category: {
            id: string;
            label: string;
            slug: string;
            icon: string | null;
        };
        client: {
            id: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        description: string;
        title: string;
        categoryId: string;
        currency: string;
        status: import(".prisma/client").$Enums.FreelanceJobStatus;
        featured: boolean;
        updatedAt: Date;
        experienceLevel: string | null;
        clientId: string;
        budgetMin: number;
        budgetMax: number;
        pricingType: string;
        deadlineDays: number;
        skills: string[];
        attachments: string[];
        locationPreference: string | null;
    }>;
    findJobs(query: {
        q?: string;
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: ({
            category: {
                id: string;
                label: string;
                slug: string;
                icon: string | null;
            };
            _count: {
                bids: number;
            };
        } & {
            id: string;
            createdAt: Date;
            description: string;
            title: string;
            categoryId: string;
            currency: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            featured: boolean;
            updatedAt: Date;
            experienceLevel: string | null;
            clientId: string;
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            skills: string[];
            attachments: string[];
            locationPreference: string | null;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findJobById(id: string): Promise<{
        category: {
            id: string;
            label: string;
            slug: string;
            icon: string | null;
        };
        bids: ({
            freelancer: {
                id: string;
                firstName: string;
                lastName: string;
            };
        } & {
            id: string;
            createdAt: Date;
            status: import(".prisma/client").$Enums.BidStatus;
            updatedAt: Date;
            coverLetter: string;
            freelanceJobId: string;
            freelancerId: string;
            amount: number;
            timelineDays: number;
            qualityScore: number | null;
        })[];
        client: {
            id: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        createdAt: Date;
        description: string;
        title: string;
        categoryId: string;
        currency: string;
        status: import(".prisma/client").$Enums.FreelanceJobStatus;
        featured: boolean;
        updatedAt: Date;
        experienceLevel: string | null;
        clientId: string;
        budgetMin: number;
        budgetMax: number;
        pricingType: string;
        deadlineDays: number;
        skills: string[];
        attachments: string[];
        locationPreference: string | null;
    }>;
    submitBid(freelancerId: string, gigId: string, dto: CreateBidDto): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.BidStatus;
        updatedAt: Date;
        coverLetter: string;
        freelanceJobId: string;
        freelancerId: string;
        amount: number;
        timelineDays: number;
        qualityScore: number | null;
    }>;
    acceptBid(bidId: string, clientId: string): Promise<{
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    }>;
    rejectBid(bidId: string, clientId: string): Promise<{
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.BidStatus;
        updatedAt: Date;
        coverLetter: string;
        freelanceJobId: string;
        freelancerId: string;
        amount: number;
        timelineDays: number;
        qualityScore: number | null;
    }>;
    getMyBids(freelancerId: string): Promise<({
        freelanceJob: {
            contract: {
                id: string;
                currency: string;
                status: import(".prisma/client").$Enums.ContractStatus;
                updatedAt: Date;
                clientId: string;
                freelanceJobId: string;
                freelancerId: string;
                agreedAmount: number;
                startedAt: Date;
                completedAt: Date | null;
            } | null;
            category: {
                id: string;
                label: string;
                slug: string;
                icon: string | null;
            };
        } & {
            id: string;
            createdAt: Date;
            description: string;
            title: string;
            categoryId: string;
            currency: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            featured: boolean;
            updatedAt: Date;
            experienceLevel: string | null;
            clientId: string;
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            skills: string[];
            attachments: string[];
            locationPreference: string | null;
        };
    } & {
        id: string;
        createdAt: Date;
        status: import(".prisma/client").$Enums.BidStatus;
        updatedAt: Date;
        coverLetter: string;
        freelanceJobId: string;
        freelancerId: string;
        amount: number;
        timelineDays: number;
        qualityScore: number | null;
    })[]>;
    getMyContracts(userId: string): Promise<({
        freelanceJob: {
            id: string;
            createdAt: Date;
            description: string;
            title: string;
            categoryId: string;
            currency: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            featured: boolean;
            updatedAt: Date;
            experienceLevel: string | null;
            clientId: string;
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            skills: string[];
            attachments: string[];
            locationPreference: string | null;
        };
        client: {
            id: string;
            firstName: string;
            lastName: string;
        };
        freelancer: {
            id: string;
            firstName: string;
            lastName: string;
        };
    } & {
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    })[]>;
    getContract(id: string): Promise<{
        freelanceJob: {
            id: string;
            createdAt: Date;
            description: string;
            title: string;
            categoryId: string;
            currency: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            featured: boolean;
            updatedAt: Date;
            experienceLevel: string | null;
            clientId: string;
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            skills: string[];
            attachments: string[];
            locationPreference: string | null;
        };
        client: {
            id: string;
            firstName: string;
            lastName: string;
        };
        freelancer: {
            id: string;
            firstName: string;
            lastName: string;
        };
        milestones: ({
            deliverables: {
                id: string;
                notes: string | null;
                milestoneId: string;
                fileUrl: string | null;
                submittedAt: Date;
            }[];
        } & {
            id: string;
            createdAt: Date;
            description: string | null;
            title: string;
            deadline: Date;
            status: import(".prisma/client").$Enums.MilestoneStatus;
            updatedAt: Date;
            amount: number;
            approvedAt: Date | null;
            contractId: string;
        })[];
    } & {
        id: string;
        currency: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    }>;
    createMilestone(freelancerId: string, contractId: string, dto: CreateMilestoneDto): Promise<{
        id: string;
        createdAt: Date;
        description: string | null;
        title: string;
        deadline: Date;
        status: import(".prisma/client").$Enums.MilestoneStatus;
        updatedAt: Date;
        amount: number;
        approvedAt: Date | null;
        contractId: string;
    }>;
}
