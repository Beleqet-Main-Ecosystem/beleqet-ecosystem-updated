import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto, QueryJobsDto } from './dto/create-job.dto';
export declare class JobsService {
    private readonly prisma;
    private readonly config;
    private readonly notificationsQueue;
    private readonly logger;
    constructor(prisma: PrismaService, config: ConfigService, notificationsQueue: Queue);
    create(employerId: string, dto: CreateJobDto): Promise<any>;
    private sendJobAlerts;
    getCategories(): Promise<any>;
    findAll(query: QueryJobsDto): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    findOne(id: string): Promise<any>;
    update(id: string, employerId: string, dto: Partial<CreateJobDto>): Promise<any>;
    remove(id: string, employerId: string): Promise<any>;
    findByCompany(employerId: string): Promise<any>;
}
