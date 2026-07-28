import { InterviewPlannerService } from './interview-planner.service';
import { CreateAvailabilityDto } from './dto/create-availability.dto';
import { AutoScheduleInterviewDto } from './dto/auto-schedule-interview.dto';
export declare class InterviewPlannerController {
    private readonly interviewPlannerService;
    constructor(interviewPlannerService: InterviewPlannerService);
    createAvailability(req: Express.Request & {
        user: {
            userId: string;
        };
    }, dto: CreateAvailabilityDto): Promise<{
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
    getAvailability(req: Express.Request & {
        user: {
            userId: string;
        };
    }): Promise<{
        id: string;
        createdAt: Date;
        userId: string;
        updatedAt: Date;
        startTime: Date;
        endTime: Date;
        timezone: string;
    }[]>;
    updateAvailability(req: Express.Request & {
        user: {
            userId: string;
        };
    }, id: string, dto: CreateAvailabilityDto): Promise<{
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
    deleteAvailability(req: Express.Request & {
        user: {
            userId: string;
        };
    }, id: string): Promise<{
        message: string;
    }>;
    autoScheduleInterview(req: Express.Request & {
        user: {
            userId: string;
        };
    }, dto: AutoScheduleInterviewDto): Promise<{
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
