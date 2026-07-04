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
            label: string;
            id: string;
            slug: string;
            icon: string | null;
        };
        client: {
            firstName: string;
            lastName: string;
            id: string;
        };
    } & {
        description: string;
        title: string;
        id: string;
        status: import(".prisma/client").$Enums.FreelanceJobStatus;
        createdAt: Date;
        updatedAt: Date;
        skills: string[];
        categoryId: string;
        currency: string;
        featured: boolean;
        experienceLevel: string | null;
        attachments: string[];
        budgetMin: number;
        budgetMax: number;
        pricingType: string;
        deadlineDays: number;
        locationPreference: string | null;
        clientId: string;
    }>;
    findJobs(query: {
        q?: string;
        category?: string;
        page?: number;
        limit?: number;
    }): Promise<{
        items: ({
            _count: {
                bids: number;
            };
            category: {
                label: string;
                id: string;
                slug: string;
                icon: string | null;
            };
        } & {
            description: string;
            title: string;
            id: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            createdAt: Date;
            updatedAt: Date;
            skills: string[];
            categoryId: string;
            currency: string;
            featured: boolean;
            experienceLevel: string | null;
            attachments: string[];
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            locationPreference: string | null;
            clientId: string;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findJobById(id: string): Promise<{
        bids: ({
            freelancer: {
                firstName: string;
                lastName: string;
                id: string;
            };
        } & {
            id: string;
            status: import(".prisma/client").$Enums.BidStatus;
            createdAt: Date;
            updatedAt: Date;
            coverLetter: string;
            amount: number;
            timelineDays: number;
            freelanceJobId: string;
            freelancerId: string;
            qualityScore: number | null;
        })[];
        category: {
            label: string;
            id: string;
            slug: string;
            icon: string | null;
        };
        client: {
            firstName: string;
            lastName: string;
            id: string;
        };
    } & {
        description: string;
        title: string;
        id: string;
        status: import(".prisma/client").$Enums.FreelanceJobStatus;
        createdAt: Date;
        updatedAt: Date;
        skills: string[];
        categoryId: string;
        currency: string;
        featured: boolean;
        experienceLevel: string | null;
        attachments: string[];
        budgetMin: number;
        budgetMax: number;
        pricingType: string;
        deadlineDays: number;
        locationPreference: string | null;
        clientId: string;
    }>;
    submitBid(freelancerId: string, gigId: string, dto: CreateBidDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.BidStatus;
        createdAt: Date;
        updatedAt: Date;
        coverLetter: string;
        amount: number;
        timelineDays: number;
        freelanceJobId: string;
        freelancerId: string;
        qualityScore: number | null;
    }>;
    acceptBid(bidId: string, clientId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        currency: string;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    }>;
    rejectBid(bidId: string, clientId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.BidStatus;
        createdAt: Date;
        updatedAt: Date;
        coverLetter: string;
        amount: number;
        timelineDays: number;
        freelanceJobId: string;
        freelancerId: string;
        qualityScore: number | null;
    }>;
    getMyBids(freelancerId: string): Promise<({
        freelanceJob: {
            contract: {
                id: string;
                status: import(".prisma/client").$Enums.ContractStatus;
                updatedAt: Date;
                currency: string;
                clientId: string;
                freelanceJobId: string;
                freelancerId: string;
                agreedAmount: number;
                startedAt: Date;
                completedAt: Date | null;
            } | null;
            category: {
                label: string;
                id: string;
                slug: string;
                icon: string | null;
            };
        } & {
            description: string;
            title: string;
            id: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            createdAt: Date;
            updatedAt: Date;
            skills: string[];
            categoryId: string;
            currency: string;
            featured: boolean;
            experienceLevel: string | null;
            attachments: string[];
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            locationPreference: string | null;
            clientId: string;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.BidStatus;
        createdAt: Date;
        updatedAt: Date;
        coverLetter: string;
        amount: number;
        timelineDays: number;
        freelanceJobId: string;
        freelancerId: string;
        qualityScore: number | null;
    })[]>;
    getMyContracts(userId: string): Promise<({
        freelanceJob: {
            description: string;
            title: string;
            id: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            createdAt: Date;
            updatedAt: Date;
            skills: string[];
            categoryId: string;
            currency: string;
            featured: boolean;
            experienceLevel: string | null;
            attachments: string[];
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            locationPreference: string | null;
            clientId: string;
        };
        freelancer: {
            firstName: string;
            lastName: string;
            id: string;
        };
        client: {
            firstName: string;
            lastName: string;
            id: string;
        };
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        currency: string;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    })[]>;
    getContract(id: string): Promise<{
        freelanceJob: {
            description: string;
            title: string;
            id: string;
            status: import(".prisma/client").$Enums.FreelanceJobStatus;
            createdAt: Date;
            updatedAt: Date;
            skills: string[];
            categoryId: string;
            currency: string;
            featured: boolean;
            experienceLevel: string | null;
            attachments: string[];
            budgetMin: number;
            budgetMax: number;
            pricingType: string;
            deadlineDays: number;
            locationPreference: string | null;
            clientId: string;
        };
        freelancer: {
            firstName: string;
            lastName: string;
            id: string;
        };
        client: {
            firstName: string;
            lastName: string;
            id: string;
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
            description: string | null;
            title: string;
            id: string;
            status: import(".prisma/client").$Enums.MilestoneStatus;
            createdAt: Date;
            updatedAt: Date;
            deadline: Date;
            amount: number;
            approvedAt: Date | null;
            contractId: string;
        })[];
    } & {
        id: string;
        status: import(".prisma/client").$Enums.ContractStatus;
        updatedAt: Date;
        currency: string;
        clientId: string;
        freelanceJobId: string;
        freelancerId: string;
        agreedAmount: number;
        startedAt: Date;
        completedAt: Date | null;
    }>;
    createMilestone(freelancerId: string, contractId: string, dto: CreateMilestoneDto): Promise<{
        description: string | null;
        title: string;
        id: string;
        status: import(".prisma/client").$Enums.MilestoneStatus;
        createdAt: Date;
        updatedAt: Date;
        deadline: Date;
        amount: number;
        approvedAt: Date | null;
        contractId: string;
    }>;
}
