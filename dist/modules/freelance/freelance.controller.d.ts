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
    findJob(id: string): Promise<{
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
    createJob(u: CurrentUserPayload, dto: CreateFreelanceJobDto): Promise<{
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
    submitBid(id: string, u: CurrentUserPayload, dto: CreateBidDto): Promise<{
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
    acceptBid(id: string, u: CurrentUserPayload): Promise<{
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
    rejectBid(id: string, u: CurrentUserPayload): Promise<{
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
    myBids(u: CurrentUserPayload): Promise<({
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
    myContracts(u: CurrentUserPayload): Promise<({
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
    contract(id: string): Promise<{
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
    createMilestone(id: string, u: CurrentUserPayload, dto: CreateMilestoneDto): Promise<{
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
    approveMilestone(id: string, u: CurrentUserPayload): Promise<{
        success: boolean;
    }>;
}
