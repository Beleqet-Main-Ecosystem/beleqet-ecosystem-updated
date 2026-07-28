import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { Queue } from 'bullmq';
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
        createdAt: Date;
        isActive: boolean;
        emailVerified: boolean;
    }[]>;
    createUser(dto: CreateUserDto): Promise<{
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        createdAt: Date;
        isActive: boolean;
        emailVerified: boolean;
    }>;
    updateUser(id: string, dto: UpdateUserDto): import(".prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        firstName: string;
        lastName: string;
        role: import(".prisma/client").$Enums.UserRole;
        id: string;
        createdAt: Date;
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
                attachments: string[];
                categoryId: string;
                currency: string;
                featured: boolean;
                experienceLevel: string | null;
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
                createdAt: Date;
                updatedAt: Date;
                telegramId: string | null;
                passwordHash: string | null;
                avatarUrl: string | null;
                phone: string | null;
                isActive: boolean;
                emailVerified: boolean;
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
                gdprConsent: boolean;
            };
            client: {
                email: string;
                firstName: string;
                lastName: string;
                role: import(".prisma/client").$Enums.UserRole;
                id: string;
                location: string | null;
                createdAt: Date;
                updatedAt: Date;
                telegramId: string | null;
                passwordHash: string | null;
                avatarUrl: string | null;
                phone: string | null;
                isActive: boolean;
                emailVerified: boolean;
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
                gdprConsent: boolean;
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
        reason: string;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
        raisedById: string;
        evidenceUrls: string[];
        resolvedAt: Date | null;
    })[]>;
    resolveDispute(id: string, dto: ResolveDisputeDto): import(".prisma/client").Prisma.Prisma__DisputeClient<{
        id: string;
        createdAt: Date;
        reason: string;
        updatedAt: Date;
        contractId: string;
        resolution: string | null;
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
                    attachments: string[];
                    categoryId: string;
                    currency: string;
                    featured: boolean;
                    experienceLevel: string | null;
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
                    createdAt: Date;
                    isActive: boolean;
                    emailVerified: boolean;
                };
                client: {
                    email: string;
                    firstName: string;
                    lastName: string;
                    role: import(".prisma/client").$Enums.UserRole;
                    id: string;
                    createdAt: Date;
                    isActive: boolean;
                    emailVerified: boolean;
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
            reason: string;
            updatedAt: Date;
            contractId: string;
            resolution: string | null;
            raisedById: string;
            evidenceUrls: string[];
            resolvedAt: Date | null;
        };
        chatHistory: any[];
    } | null>;
    exportUserData(userId: string): Promise<{
        data: {
            twoFactor: {
                enabled: boolean;
            } | null;
            company?: {
                name: string;
                description: string | null;
                id: string;
                location: string | null;
                createdAt: Date;
                userId: string;
                updatedAt: Date;
                linkedinUrl: string | null;
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
            } | null | undefined;
            kycVerification?: {
                id: string;
                status: import(".prisma/client").$Enums.KycStatus;
                createdAt: Date;
                userId: string;
                updatedAt: Date;
                documentType: import(".prisma/client").$Enums.KycDocumentType;
                documentUrl: string;
                faceScanUrl: string;
                matchScore: number | null;
                livenessPassed: boolean | null;
                rejectionReason: string | null;
                verifiedAt: Date | null;
            } | null | undefined;
            applications?: {
                id: string;
                status: import(".prisma/client").$Enums.ApplicationStatus;
                createdAt: Date;
                userId: string;
                updatedAt: Date;
                portfolioUrl: string | null;
                jobId: string;
                coverLetter: string | null;
                resumeUrl: string | null;
                screeningAnswers: import("@prisma/client/runtime/library").JsonValue | null;
                expectedSalary: number | null;
                interviewSlot: Date | null;
                notes: string | null;
            }[] | undefined;
            bids?: {
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
            }[] | undefined;
            contractsAsClient?: {
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
            }[] | undefined;
            contractsAsFreelancer?: {
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
            }[] | undefined;
            freelanceJobs?: {
                description: string;
                title: string;
                id: string;
                status: import(".prisma/client").$Enums.FreelanceJobStatus;
                createdAt: Date;
                updatedAt: Date;
                skills: string[];
                attachments: string[];
                categoryId: string;
                currency: string;
                featured: boolean;
                experienceLevel: string | null;
                budgetMin: number;
                budgetMax: number;
                pricingType: string;
                deadlineDays: number;
                locationPreference: string | null;
                clientId: string;
            }[] | undefined;
            subscriptions?: ({
                transactions: {
                    id: string;
                    status: import(".prisma/client").$Enums.PaymentStatus;
                    createdAt: Date;
                    currency: string;
                    amount: number;
                    gatewayReference: string | null;
                    rawPayload: import("@prisma/client/runtime/library").JsonValue | null;
                    subscriptionId: string;
                }[];
            } & {
                id: string;
                status: import(".prisma/client").$Enums.SubscriptionStatus;
                createdAt: Date;
                userId: string;
                updatedAt: Date;
                provider: import(".prisma/client").$Enums.PaymentProvider | null;
                planId: string;
                currentPeriodStart: Date;
                currentPeriodEnd: Date;
                cancelAtPeriodEnd: boolean;
                providerSubscriptionId: string | null;
                reminderSentAt: Date | null;
            })[] | undefined;
            email?: string | undefined;
            firstName?: string | undefined;
            lastName?: string | undefined;
            role?: import(".prisma/client").$Enums.UserRole | undefined;
            id?: string | undefined;
            location?: string | null | undefined;
            createdAt?: Date | undefined;
            updatedAt?: Date | undefined;
            telegramId?: string | null | undefined;
            passwordHash?: string | null | undefined;
            avatarUrl?: string | null | undefined;
            phone?: string | null | undefined;
            isActive?: boolean | undefined;
            emailVerified?: boolean | undefined;
            bio?: string | null | undefined;
            defaultResumeUrl?: string | null | undefined;
            githubUrl?: string | null | undefined;
            headline?: string | null | undefined;
            linkedinUrl?: string | null | undefined;
            portfolioUrl?: string | null | undefined;
            skills?: string[] | undefined;
            clientFeedback?: import("@prisma/client/runtime/library").JsonValue | undefined;
            skillVerified?: boolean | undefined;
            kycVerified?: boolean | undefined;
            gdprConsent?: boolean | undefined;
        };
    }>;
}
export {};
