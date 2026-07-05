import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, CreateCompanyDto } from './dto/update-user.dto';
export declare class UsersService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findById(id: string): Promise<any>;
    update(id: string, dto: UpdateUserDto): Promise<any>;
    addClientFeedback(userId: string, feedback: any): Promise<any>;
    verifySkill(userId: string, status: boolean): Promise<any>;
    createCompany(userId: string, dto: CreateCompanyDto): Promise<any>;
    getCompany(userId: string): Promise<any>;
    getNotifications(userId: string): Promise<any>;
    markNotificationRead(notificationId: string, userId: string): Promise<any>;
    markAllNotificationsRead(userId: string): Promise<any>;
    getSavedJobs(userId: string): Promise<any>;
    private getSavedJobsWithDetails;
    saveJob(userId: string, jobId: string): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        jobId: string;
    }>;
    removeSavedJob(userId: string, jobId: string): Promise<{
        count: any;
    }>;
    getCvDraft(userId: string): Promise<any>;
    saveCvDraft(userId: string, data: Record<string, unknown>): Promise<{
        id: `${string}-${string}-${string}-${string}-${string}`;
        userId: string;
        data: Record<string, unknown>;
    }>;
}
