import { ObjectType, Field, ID, Float, Int, registerEnumType, InputType } from '@nestjs/graphql';

// ── Enums ────────────────────────────────────────────────────────────────

/** GraphQL enum for user roles */
export enum GqlUserRole {
  ADMIN = 'ADMIN',
  EMPLOYER = 'EMPLOYER',
  JOB_SEEKER = 'JOB_SEEKER',
  FREELANCER = 'FREELANCER',
}

/** GraphQL enum for job types */
export enum GqlJobType {
  FULL_TIME = 'FULL_TIME',
  PART_TIME = 'PART_TIME',
  REMOTE = 'REMOTE',
  HYBRID = 'HYBRID',
  CONTRACT = 'CONTRACT',
}

/** GraphQL enum for job status */
export enum GqlJobStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  CLOSED = 'CLOSED',
  ARCHIVED = 'ARCHIVED',
}

/** GraphQL enum for application status */
export enum GqlApplicationStatus {
  SUBMITTED = 'SUBMITTED',
  SCREENING = 'SCREENING',
  SHORTLISTED = 'SHORTLISTED',
  INTERVIEW_SCHEDULED = 'INTERVIEW_SCHEDULED',
  OFFERED = 'OFFERED',
  REJECTED = 'REJECTED',
  WITHDRAWN = 'WITHDRAWN',
}

registerEnumType(GqlUserRole, { name: 'GqlUserRole', description: 'User roles on the platform' });
registerEnumType(GqlJobType, { name: 'GqlJobType', description: 'Types of employment' });
registerEnumType(GqlJobStatus, { name: 'GqlJobStatus', description: 'Job listing statuses' });
registerEnumType(GqlApplicationStatus, {
  name: 'GqlApplicationStatus',
  description: 'Application statuses',
});

// ── Object Types ─────────────────────────────────────────────────────────

/** GraphQL type for User */
@ObjectType({ description: 'Platform user (employer, job seeker, freelancer, or admin)' })
export class GqlUser {
  @Field(() => ID) id!: string;
  @Field(() => String) email!: string;
  @Field(() => String) firstName!: string;
  @Field(() => String) lastName!: string;
  @Field(() => GqlUserRole) role!: GqlUserRole;
  @Field(() => String, { nullable: true }) avatarUrl?: string | null;
  @Field(() => String, { nullable: true }) phone?: string | null;
  @Field(() => String, { nullable: true }) headline?: string | null;
  @Field(() => String, { nullable: true }) bio?: string | null;
  @Field(() => String, { nullable: true }) location?: string | null;
  @Field(() => [String], { nullable: true }) skills?: string[];
  @Field(() => String, { nullable: true }) githubUrl?: string | null;
  @Field(() => String, { nullable: true }) linkedinUrl?: string | null;
  @Field(() => String, { nullable: true }) portfolioUrl?: string | null;
  @Field(() => Boolean) isActive!: boolean;
  @Field(() => Boolean) emailVerified!: boolean;
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
}

/** GraphQL type for Company */
@ObjectType({ description: 'Employer company profile' })
export class GqlCompany {
  @Field(() => ID) id!: string;
  @Field(() => String) name!: string;
  @Field(() => String, { nullable: true }) description?: string | null;
  @Field(() => String, { nullable: true }) logoUrl?: string | null;
  @Field(() => String, { nullable: true }) website?: string | null;
  @Field(() => String, { nullable: true }) industry?: string | null;
  @Field(() => String, { nullable: true }) size?: string | null;
  @Field(() => Boolean) verified!: boolean;
  @Field(() => String, { nullable: true }) location?: string | null;
  @Field(() => Date) createdAt!: Date;
  @Field(() => String, { nullable: true }) userId?: string;
}

/** GraphQL type for JobCategory */
@ObjectType({ description: 'Job category' })
export class GqlJobCategory {
  @Field(() => ID) id!: string;
  @Field(() => String) slug!: string;
  @Field(() => String) label!: string;
  @Field(() => String, { nullable: true }) icon?: string | null;
}

/** GraphQL type for Job listing */
@ObjectType({ description: 'Job listing on the platform' })
export class GqlJob {
  @Field(() => ID) id!: string;
  @Field(() => String) title!: string;
  @Field(() => String) description!: string;
  @Field(() => String, { nullable: true }) requirements?: string | null;
  @Field(() => String) location!: string;
  @Field(() => GqlJobType) type!: GqlJobType;
  @Field(() => String) categoryId!: string;
  @Field(() => Int, { nullable: true }) salaryMin?: number | null;
  @Field(() => Int, { nullable: true }) salaryMax?: number | null;
  @Field(() => String, { nullable: true }) currency?: string;
  @Field(() => Date, { nullable: true }) deadline?: Date | null;
  @Field(() => GqlJobStatus) status!: GqlJobStatus;
  @Field(() => Boolean) featured!: boolean;
  @Field(() => String) companyId!: string;
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
  @Field(() => String, { nullable: true }) experienceLevel?: string | null;
  @Field(() => String, { nullable: true }) qualification?: string | null;
  @Field(() => String, { nullable: true }) salaryType?: string | null;
  @Field(() => [String], { nullable: true }) tags?: string[];
  @Field(() => Boolean) urgent!: boolean;
  @Field(() => Int, { nullable: true }) vacancies?: number | null;
  @Field(() => String, { nullable: true }) yearsOfExperience?: string | null;

  // Resolved fields (populated by DataLoaders)
  @Field(() => GqlCompany, { nullable: true }) company?: GqlCompany;
  @Field(() => GqlJobCategory, { nullable: true }) category?: GqlJobCategory;
  @Field(() => Int, { nullable: true, description: 'Total applications count' })
  applicationCount?: number;
}

/** GraphQL type for Application */
@ObjectType({ description: 'Job application' })
export class GqlApplication {
  @Field(() => ID) id!: string;
  @Field(() => String) jobId!: string;
  @Field(() => String) userId!: string;
  @Field(() => String, { nullable: true }) coverLetter?: string | null;
  @Field(() => String, { nullable: true }) resumeUrl?: string | null;
  @Field(() => GqlApplicationStatus) status!: GqlApplicationStatus;
  @Field(() => Date, { nullable: true }) interviewSlot?: Date | null;
  @Field(() => Date) createdAt!: Date;
  @Field(() => Date) updatedAt!: Date;
  @Field(() => Int, { nullable: true }) expectedSalary?: number | null;
  @Field(() => String, { nullable: true }) portfolioUrl?: string | null;

  // Resolved fields
  @Field(() => GqlJob, { nullable: true }) job?: GqlJob;
  @Field(() => GqlUser, { nullable: true }) user?: GqlUser;
}

/** GraphQL type for FreelanceJob */
@ObjectType({ description: 'Freelance job listing' })
export class GqlFreelanceJob {
  @Field(() => ID) id!: string;
  @Field(() => String) title!: string;
  @Field(() => String) description!: string;
  @Field(() => String) categoryId!: string;
  @Field(() => String) clientId!: string;
  @Field(() => Int) budgetMin!: number;
  @Field(() => Int) budgetMax!: number;
  @Field(() => String, { nullable: true }) currency?: string;
  @Field(() => String, { nullable: true }) pricingType?: string;
  @Field(() => Int) deadlineDays!: number;
  @Field(() => [String]) skills!: string[];
  @Field(() => String, { nullable: true }) status?: string;
  @Field(() => Boolean) featured!: boolean;
  @Field(() => Date) createdAt!: Date;
  @Field(() => Int, { nullable: true, description: 'Number of bids' }) bidCount?: number;
}

/** Paginated job results */
@ObjectType({ description: 'Paginated job listing results' })
export class GqlJobConnection {
  @Field(() => [GqlJob]) jobs!: GqlJob[];
  @Field(() => Int) total!: number;
  @Field(() => Int) page!: number;
  @Field(() => Int) limit!: number;
  @Field(() => Int) totalPages!: number;
  @Field(() => Boolean) hasNextPage!: boolean;
}

/** Paginated application results */
@ObjectType({ description: 'Paginated application results' })
export class GqlApplicationConnection {
  @Field(() => [GqlApplication]) applications!: GqlApplication[];
  @Field(() => Int) total!: number;
  @Field(() => Int) page!: number;
  @Field(() => Int) limit!: number;
}

// ── Input Types ──────────────────────────────────────────────────────────

/** Input for filtering/searching jobs */
@InputType({ description: 'Job search and filter parameters' })
export class GqlJobFilterInput {
  @Field(() => String, { nullable: true }) search?: string;
  @Field(() => String, { nullable: true }) location?: string;
  @Field(() => GqlJobType, { nullable: true }) type?: GqlJobType;
  @Field(() => GqlJobStatus, { nullable: true }) status?: GqlJobStatus;
  @Field(() => Int, { nullable: true }) salaryMin?: number;
  @Field(() => Int, { nullable: true }) salaryMax?: number;
  @Field(() => String, { nullable: true }) categoryId?: string;
  @Field(() => String, { nullable: true }) companyId?: string;
  @Field(() => Boolean, { nullable: true }) featured?: boolean;
  @Field(() => Int, { nullable: true, description: 'Page number (1-indexed)' }) page?: number;
  @Field(() => Int, { nullable: true, description: 'Items per page (max 100)' }) limit?: number;
}

/** Input for filtering applications */
@InputType({ description: 'Application filter parameters' })
export class GqlApplicationFilterInput {
  @Field(() => GqlApplicationStatus, { nullable: true }) status?: GqlApplicationStatus;
  @Field(() => String, { nullable: true }) jobId?: string;
  @Field(() => String, { nullable: true }) userId?: string;
  @Field(() => Int, { nullable: true }) page?: number;
  @Field(() => Int, { nullable: true }) limit?: number;
}

/** Dashboard analytics summary */
@ObjectType({ description: 'Platform analytics dashboard summary' })
export class GqlAnalyticsSummary {
  @Field(() => Int) totalUsers!: number;
  @Field(() => Int) totalJobs!: number;
  @Field(() => Int) totalApplications!: number;
  @Field(() => Int) activeJobs!: number;
  @Field(() => Int) totalCompanies!: number;
  @Field(() => Float) averageApplicationsPerJob!: number;
}
