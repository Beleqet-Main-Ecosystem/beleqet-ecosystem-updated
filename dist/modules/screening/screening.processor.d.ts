import { WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
export declare class ScreeningProcessor extends WorkerHost {
    private readonly prisma;
    private readonly eventEmitter;
    private readonly config;
    private readonly notificationsQueue;
    private readonly analyticsQueue;
    private readonly applicationQueue;
    private readonly logger;
    private readonly openai;
    constructor(prisma: PrismaService, eventEmitter: EventEmitter2, config: ConfigService, notificationsQueue: Queue, analyticsQueue: Queue, applicationQueue: Queue);
    process(job: Job): Promise<any>;
    private handleScreenCandidate;
    private handleNotifyRecruiter;
    private handleScheduleInterview;
    private handleJobFailure;
    private runAiScoring;
}
