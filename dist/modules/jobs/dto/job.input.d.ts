import { JobType } from './create-job.dto';
export declare class QueryJobsInput {
    q?: string;
    category?: string;
    location?: string;
    type?: JobType;
    page?: number;
    limit?: number;
}
export declare class CreateJobInput {
    title: string;
    description: string;
    location: string;
    type: JobType;
    categoryId: string;
    salaryMin?: number;
    salaryMax?: number;
}
