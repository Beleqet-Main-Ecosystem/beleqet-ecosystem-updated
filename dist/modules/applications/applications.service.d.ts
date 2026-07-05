import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { ConfigService } from '@nestjs/config';
export declare class ApplicationsService {
    private readonly prisma;
    private readonly eventEmitter;
    private readonly applicationQueue;
    private readonly analyticsQueue;
    private readonly notificationsQueue;
    private readonly config;
    private readonly logger;
    constructor(prisma: PrismaService, eventEmitter: EventEmitter2, applicationQueue: Queue, analyticsQueue: Queue, notificationsQueue: Queue, config: ConfigService);
    submit(userId: string, dto: CreateApplicationDto): Promise<any>;
    findByUser(userId: string): Promise<any>;
    findByJob(jobId: string, employerId: string): Promise<any>;
    findOne(id: string): Promise<any>;
    updateStatus(id: string, status: string, employerId: string): Promise<any>;
    withdraw(id: string, userId: string): Promise<any>;
}
