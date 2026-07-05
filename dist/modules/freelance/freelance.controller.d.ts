import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FreelanceService, CreateFreelanceJobDto, CreateBidDto, CreateMilestoneDto } from './freelance.service';
import { EscrowService } from '../escrow/escrow.service';
export declare class FreelanceController {
    private readonly svc;
    private readonly escrowSvc;
    constructor(svc: FreelanceService, escrowSvc: EscrowService);
    findJobs(q: {
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
    findJob(id: string): Promise<{
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
    createJob(u: CurrentUserPayload, dto: CreateFreelanceJobDto): Promise<{
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
    submitBid(id: string, u: CurrentUserPayload, dto: CreateBidDto): Promise<{
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
    acceptBid(id: string, u: CurrentUserPayload): Promise<{
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
    rejectBid(id: string, u: CurrentUserPayload): Promise<{
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
    myBids(u: CurrentUserPayload): Promise<({
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
    myContracts(u: CurrentUserPayload): Promise<({
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
    contract(id: string): Promise<{
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
    createMilestone(id: string, u: CurrentUserPayload, dto: CreateMilestoneDto): Promise<{
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
    approveMilestone(id: string, u: CurrentUserPayload): Promise<{
        success: boolean;
    }>;
}
