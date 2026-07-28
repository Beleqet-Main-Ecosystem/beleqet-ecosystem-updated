import { JobType, JobStatus } from './create-job.dto';
export declare class JobCategoryType {
    id: string;
    label: string;
    slug: string;
}
export declare class CompanyType {
    id: string;
    name: string;
    logo?: string;
}
export declare class JobTypeGraphQL {
    id: string;
    title: string;
    description: string;
    requirements?: string;
    location: string;
    type: JobType;
    salaryMin?: number;
    salaryMax?: number;
    currency: string;
    status: JobStatus;
    featured: boolean;
    createdAt: Date;
    company?: CompanyType;
    category?: JobCategoryType;
}
export declare class PaginatedJobsType {
    items: JobTypeGraphQL[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}
