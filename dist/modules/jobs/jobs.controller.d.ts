import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { JobsService } from './jobs.service';
import { CreateJobDto, QueryJobsDto } from './dto/create-job.dto';
export declare class JobsController {
    private readonly svc;
    constructor(svc: JobsService);
    findAll(query: QueryJobsDto): Promise<{
        items: any;
        total: any;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    myJobs(user: CurrentUserPayload): Promise<any>;
    getCategories(): Promise<any>;
    findOne(id: string): Promise<any>;
    create(user: CurrentUserPayload, dto: CreateJobDto): Promise<any>;
    update(id: string, user: CurrentUserPayload, dto: Partial<CreateJobDto>): Promise<any>;
    remove(id: string, user: CurrentUserPayload): Promise<any>;
}
