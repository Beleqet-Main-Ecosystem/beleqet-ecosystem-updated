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
    getUsers(): any;
    createUser(dto: CreateUserDto): Promise<any>;
    updateUser(id: string, dto: UpdateUserDto): any;
    deleteUser(id: string, admin: CurrentUserPayload): Promise<{
        deleted: boolean;
        reason: string;
    } | {
        deleted: boolean;
        reason?: undefined;
    }>;
    getContacts(): any;
    updateContact(id: string, body: {
        status: 'NEW' | 'READ' | 'RESOLVED';
    }): any;
    broadcast(dto: BroadcastDto): Promise<{
        delivered: any;
    }>;
    getDisputes(): any;
    resolveDispute(id: string, dto: ResolveDisputeDto): any;
    getArbitrationDetails(id: string): Promise<{
        dispute: any;
        chatHistory: any[];
    } | null>;
    exportUserData(userId: string): Promise<{
        data: any;
    }>;
}
export {};
