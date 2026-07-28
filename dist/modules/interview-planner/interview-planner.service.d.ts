import { PrismaService } from '../../prisma/prisma.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { CreateInterviewDto } from './dto/create-interview.dto';
import { I18nService } from 'nestjs-i18n';
import { NotificationsService } from '@modules/notifications/notifications.service';
import { AvailabilityHelper } from './helpers/availability.helper';
import { CommonAvailabilityHelper } from './helpers/common-availability.helper';
import { ApplicationHelper } from './helpers/application.helper';
import { DateHelper } from './helpers/date.helper';
export declare class InterviewPlannerService {
    private readonly prisma;
    private readonly i18n;
    private readonly notificationsService;
    private readonly availabilityHelper;
    private readonly commonAvailabilityHelper;
    private readonly applicationHelper;
    private readonly dateHelper;
    private readonly logger;
    constructor(prisma: PrismaService, i18n: I18nService, notificationsService: NotificationsService, availabilityHelper: AvailabilityHelper, commonAvailabilityHelper: CommonAvailabilityHelper, applicationHelper: ApplicationHelper, dateHelper: DateHelper);
    createAvailability(userId: string, dto: CreateAvailabilityDto): Promise<{
        message: string;
        data: {
            id: string;
            createdAt: Date;
            userId: string;
            updatedAt: Date;
            startTime: Date;
            endTime: Date;
            timezone: string;
        };
    }>;
    getUserAvailabilities(userId: string): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        startTime: Date;
        endTime: Date;
        timezone: string;
    }[]>;
    updateAvailability(userId: string, id: string, dto: CreateAvailabilityDto): Promise<{
        message: string;
        data: {
            id: string;
            createdAt: Date;
            userId: string;
            updatedAt: Date;
            startTime: Date;
            endTime: Date;
            timezone: string;
        };
    }>;
    deleteAvailability(userId: string, id: string): Promise<{
        message: string;
    }>;
    createInterview(employerId: string, dto: CreateInterviewDto): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.InterviewStatus;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        applicationId: string;
        startTime: Date;
        endTime: Date;
        timezone: string;
        employerId: string;
        candidateId: string;
        durationMinutes: number;
        meetingLink: string | null;
    }>;
    findCommonAvailability(employerId: string, candidateId: string): Promise<import("./types/availability.types").AvailabilityOverlap[]>;
    autoScheduleInterview(employerId: string, applicationId: string): Promise<{
        id: string;
        status: import(".prisma/client").$Enums.InterviewStatus;
        createdAt: Date;
        updatedAt: Date;
        notes: string | null;
        applicationId: string;
        startTime: Date;
        endTime: Date;
        timezone: string;
        employerId: string;
        candidateId: string;
        durationMinutes: number;
        meetingLink: string | null;
    }>;
}
