import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Queue } from 'bull';
import { ChatService } from '../chat/chat.service';
declare enum ManagedRole {
    JOB_SEEKER = "JOB_SEEKER",
    EMPLOYER = "EMPLOYER",
    FREELANCER = "FREELANCER",
    ADMIN = "ADMIN"
}
declare class CreateUserDto {
    email: string;
    firstName: string;
    lastName: string;
    password: string;
    role: ManagedRole;
}
declare class UpdateUserDto {
    firstName?: string;
    lastName?: string;
    role?: ManagedRole;
    isActive?: boolean;
}
declare class BroadcastDto {
    title: string;
    body: string;
    role?: ManagedRole;
    userIds?: string[];
}
declare class ResolveDisputeDto {
    resolution: string;
}
export declare class AdminController {
    private readonly prisma;
    private readonly chatService;
    private readonly notificationsQueue;
    constructor(prisma: PrismaService, chatService: ChatService, notificationsQueue: Queue);
    getUsers(): import(".prisma/client").Prisma.PrismaPromise<{
        id: string;
        createdAt: Date;
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: boolean;
    }[]>;
    createUser(dto: CreateUserDto): Promise<{
        id: string;
        createdAt: Date;
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: boolean;
    }>;
    updateUser(id: string, dto: UpdateUserDto): import(".prisma/client").Prisma.Prisma__UserClient<{
        id: string;
        createdAt: Date;
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        isActive: boolean;
        emailVerified: boolean;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    deleteUser(id: string, admin: CurrentUserPayload): Promise<{
        deleted: boolean;
        reason: string;
    } | {
        deleted: boolean;
        reason?: undefined;
    }>;
    getContacts(): import(".prisma/client").Prisma.PrismaPromise<{
        message: string;
        id: string;
        createdAt: Date;
        name: string;
        status: import(".prisma/client").$Enums.ContactMessageStatus;
        updatedAt: Date;
        email: string;
        subject: string;
    }[]>;
    updateContact(id: string, body: {
        status: 'NEW' | 'READ' | 'RESOLVED';
    }): import(".prisma/client").Prisma.Prisma__ContactMessageClient<{
        message: string;
        id: string;
        createdAt: Date;
        name: string;
        status: import(".prisma/client").$Enums.ContactMessageStatus;
        updatedAt: Date;
        email: string;
        subject: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    broadcast(dto: BroadcastDto): Promise<{
        delivered: number;
    }>;
    getDisputes(): import(".prisma/client").Prisma.PrismaPromise<({
        contract: {
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
                createdAt: Date;
                location: string | null;
                updatedAt: Date;
                skills: string[];
                portfolioUrl: string | null;
                email: string;
                passwordHash: string;
                firstName: string;
                lastName: string;
                role: import(".prisma/client").$Enums.UserRole;
                avatarUrl: string | null;
                phone: string | null;
                telegramId: string | null;
                isActive: boolean;
                emailVerified: boolean;
                bio: string | null;
                defaultResumeUrl: string | null;
                githubUrl: string | null;
                headline: string | null;
                linkedinUrl: string | null;
                clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
                skillVerified: boolean;
            };
            freelancer: {
                id: string;
                createdAt: Date;
                location: string | null;
                updatedAt: Date;
                skills: string[];
                portfolioUrl: string | null;
                email: string;
                passwordHash: string;
                firstName: string;
                lastName: string;
                role: import(".prisma/client").$Enums.UserRole;
                avatarUrl: string | null;
                phone: string | null;
                telegramId: string | null;
                isActive: boolean;
                emailVerified: boolean;
                bio: string | null;
                defaultResumeUrl: string | null;
                githubUrl: string | null;
                headline: string | null;
                linkedinUrl: string | null;
                clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
                skillVerified: boolean;
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
        };
    } & {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
        reason: string;
        raisedById: string;
        evidenceUrls: string[];
        resolvedAt: Date | null;
    })[]>;
    resolveDispute(id: string, dto: ResolveDisputeDto): import(".prisma/client").Prisma.Prisma__DisputeClient<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
        reason: string;
        raisedById: string;
        evidenceUrls: string[];
        resolvedAt: Date | null;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    getArbitrationDetails(id: string): Promise<{
        dispute: {
            contract: {
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
                    createdAt: Date;
                    email: string;
                    firstName: string;
                    lastName: string;
                    role: import(".prisma/client").$Enums.UserRole;
                    isActive: boolean;
                    emailVerified: boolean;
                };
                freelancer: {
                    id: string;
                    createdAt: Date;
                    email: string;
                    firstName: string;
                    lastName: string;
                    role: import(".prisma/client").$Enums.UserRole;
                    isActive: boolean;
                    emailVerified: boolean;
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
            };
        } & {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            contractId: string;
            resolution: string | null;
            reason: string;
            raisedById: string;
            evidenceUrls: string[];
            resolvedAt: Date | null;
        };
        chatHistory: any[];
    } | null>;
    exportUserData(userId: string): Promise<{
        data: ({
            company: {
                id: string;
                createdAt: Date;
                name: string;
                description: string | null;
                location: string | null;
                updatedAt: Date;
                userId: string;
                linkedinUrl: string | null;
                logoUrl: string | null;
                website: string | null;
                industry: string | null;
                size: string | null;
                verified: boolean;
                benefits: string[];
                coverImageUrl: string | null;
                facebookUrl: string | null;
                foundedYear: number | null;
                twitterUrl: string | null;
            } | null;
            applications: {
                id: string;
                createdAt: Date;
                status: import(".prisma/client").$Enums.ApplicationStatus;
                updatedAt: Date;
                jobId: string;
                userId: string;
                coverLetter: string | null;
                resumeUrl: string | null;
                interviewSlot: Date | null;
                notes: string | null;
                expectedSalary: number | null;
                portfolioUrl: string | null;
                screeningAnswers: import("@prisma/client/runtime/library").JsonValue | null;
            }[];
            bids: {
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
            }[];
            contractsAsClient: {
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
            }[];
            contractsAsFreelancer: {
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
            }[];
            freelanceJobs: {
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
            }[];
        } & {
            id: string;
            createdAt: Date;
            location: string | null;
            updatedAt: Date;
            skills: string[];
            portfolioUrl: string | null;
            email: string;
            passwordHash: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            avatarUrl: string | null;
            phone: string | null;
            telegramId: string | null;
            isActive: boolean;
            emailVerified: boolean;
            bio: string | null;
            defaultResumeUrl: string | null;
            githubUrl: string | null;
            headline: string | null;
            linkedinUrl: string | null;
            clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
            skillVerified: boolean;
        }) | null;
    }>;
}
export {};
