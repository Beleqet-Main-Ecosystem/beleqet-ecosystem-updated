import { Job as BullJob } from 'bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
interface ScreenCandidatePayload {
    applicationId: string;
    userId: string;
    jobId: string;
    jobTitle: string;
    jobDescription: string;
    jobRequirements?: string;
    coverLetter?: string;
    resumeUrl?: string;
    companyId: string;
}
export declare class ScreeningProcessor {
    private readonly prisma;
    private readonly eventEmitter;
    private readonly config;
    private readonly notificationsQueue;
    private readonly analyticsQueue;
    private readonly logger;
    private readonly openai;
    constructor(prisma: PrismaService, eventEmitter: EventEmitter2, config: ConfigService, notificationsQueue: Queue, analyticsQueue: Queue);
    handleScreenCandidate(job: BullJob<ScreenCandidatePayload>): Promise<{
        applicationId: string;
        score: number;
        status: string;
    }>;
    handleNotifyRecruiter(job: BullJob<{
        applicationId: string;
        jobTitle: string;
        companyId: string;
        applicantName: string;
    }>): Promise<void>;
    handleScheduleInterview(job: BullJob<{
        applicationId: string;
        userId: string;
        jobId: string;
        jobTitle: string;
    }>): Promise<void>;
    onFailed(job: BullJob, error: Error): Promise<void>;
    onCompleted(job: BullJob): void;
    private runAiScoring;
}
export {};
