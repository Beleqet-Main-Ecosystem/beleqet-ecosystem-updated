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
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        isActive: boolean;
        emailVerified: boolean;
        createdAt: Date;
    }[]>;
    createUser(dto: CreateUserDto): Promise<{
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        isActive: boolean;
        emailVerified: boolean;
        createdAt: Date;
    }>;
    updateUser(id: string, dto: UpdateUserDto): import(".prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        isActive: boolean;
        emailVerified: boolean;
        createdAt: Date;
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
        name: string;
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.ContactMessageStatus;
        createdAt: Date;
        updatedAt: Date;
        subject: string;
    }[]>;
    updateContact(id: string, body: {
        status: 'NEW' | 'READ' | 'RESOLVED';
    }): import(".prisma/client").Prisma.Prisma__ContactMessageClient<{
        message: string;
        name: string;
        email: string;
        id: string;
        status: import(".prisma/client").$Enums.ContactMessageStatus;
        createdAt: Date;
        updatedAt: Date;
        subject: string;
    }, never, import("@prisma/client/runtime/library").DefaultArgs>;
    broadcast(dto: BroadcastDto): Promise<{
        delivered: number;
    }>;
    getDisputes(): import(".prisma/client").Prisma.PrismaPromise<({
        contract: {
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
                email: string;
                firstName: string;
                lastName: string;
                role: import(".prisma/client").$Enums.UserRole;
                id: string;
                location: string | null;
                telegramId: string | null;
                passwordHash: string;
                avatarUrl: string | null;
                phone: string | null;
                isActive: boolean;
                emailVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
                bio: string | null;
                defaultResumeUrl: string | null;
                githubUrl: string | null;
                headline: string | null;
                linkedinUrl: string | null;
                portfolioUrl: string | null;
                skills: string[];
                clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
                skillVerified: boolean;
                kycVerified: boolean;
            };
            client: {
                email: string;
                firstName: string;
                lastName: string;
                role: import(".prisma/client").$Enums.UserRole;
                id: string;
                location: string | null;
                telegramId: string | null;
                passwordHash: string;
                avatarUrl: string | null;
                phone: string | null;
                isActive: boolean;
                emailVerified: boolean;
                createdAt: Date;
                updatedAt: Date;
                bio: string | null;
                defaultResumeUrl: string | null;
                githubUrl: string | null;
                headline: string | null;
                linkedinUrl: string | null;
                portfolioUrl: string | null;
                skills: string[];
                clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
                skillVerified: boolean;
                kycVerified: boolean;
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
                    email: string;
                    firstName: string;
                    lastName: string;
                    role: import(".prisma/client").$Enums.UserRole;
                    id: string;
                    isActive: boolean;
                    emailVerified: boolean;
                    createdAt: Date;
                };
                client: {
                    email: string;
                    firstName: string;
                    lastName: string;
                    role: import(".prisma/client").$Enums.UserRole;
                    id: string;
                    isActive: boolean;
                    emailVerified: boolean;
                    createdAt: Date;
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
                name: string;
                description: string | null;
                id: string;
                location: string | null;
                createdAt: Date;
                updatedAt: Date;
                linkedinUrl: string | null;
                userId: string;
                logoUrl: string | null;
                website: string | null;
                industry: string | null;
                size: string | null;
                twitterUrl: string | null;
                facebookUrl: string | null;
                coverImageUrl: string | null;
                benefits: string[];
                foundedYear: number | null;
                verified: boolean;
            } | null;
            kycVerification: {
                id: string;
                status: import(".prisma/client").$Enums.KycStatus;
                createdAt: Date;
                updatedAt: Date;
                userId: string;
                documentType: import(".prisma/client").$Enums.KycDocumentType;
                documentUrl: string;
                faceScanUrl: string;
                matchScore: number | null;
                livenessPassed: boolean | null;
                rejectionReason: string | null;
                verifiedAt: Date | null;
            } | null;
            applications: {
                id: string;
                status: import(".prisma/client").$Enums.ApplicationStatus;
                createdAt: Date;
                updatedAt: Date;
                portfolioUrl: string | null;
                userId: string;
                jobId: string;
                coverLetter: string | null;
                resumeUrl: string | null;
                screeningAnswers: import("@prisma/client/runtime/library").JsonValue | null;
                expectedSalary: number | null;
                interviewSlot: Date | null;
                notes: string | null;
            }[];
            bids: {
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
            }[];
            contractsAsClient: {
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
            }[];
            contractsAsFreelancer: {
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
            }[];
            freelanceJobs: {
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
            }[];
        } & {
            email: string;
            firstName: string;
            lastName: string;
            role: import(".prisma/client").$Enums.UserRole;
            id: string;
            location: string | null;
            telegramId: string | null;
            passwordHash: string;
            avatarUrl: string | null;
            phone: string | null;
            isActive: boolean;
            emailVerified: boolean;
            createdAt: Date;
            updatedAt: Date;
            bio: string | null;
            defaultResumeUrl: string | null;
            githubUrl: string | null;
            headline: string | null;
            linkedinUrl: string | null;
            portfolioUrl: string | null;
            skills: string[];
            clientFeedback: import("@prisma/client/runtime/library").JsonValue | null;
            skillVerified: boolean;
            kycVerified: boolean;
        }) | null;
    }>;
}
export {};
