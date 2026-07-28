import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobTypeGraphQL, PaginatedJobsType, CompanyType, JobCategoryType } from './dto/job.type';
import { CreateJobInput, QueryJobsInput } from './dto/job.input';

// ── Security Guards & Decorators ─────────────────────────────────────────────
import { GqlAuthGuard } from '../../graphql/guards/gql-auth.guard';
import { GqlRolesGuard } from '../../common/guards/gql-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GqlCurrentUser } from '../../common/decorators/gql-current-user.decorator';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

// ── DataLoaders (Turbo Mode - N+1 Prevention) ────────────────────────────────
import { CompanyLoader } from '../../graphql/loaders/company.loader';
import { CategoryLoader } from '../../graphql/loaders/category.loader';

@Resolver(() => JobTypeGraphQL)
export class JobsResolver {
  constructor(
    private readonly jobsService: JobsService,
    private readonly companyLoader: CompanyLoader,
    private readonly categoryLoader: CategoryLoader,
  ) {}

  /**
   * Fetches a paginated list of jobs.
   */
  @Query(() => PaginatedJobsType, { name: 'jobs' })
  async jobs(
    @Args('query', { type: () => QueryJobsInput, nullable: true }) query: QueryJobsInput,
  ) {
    return this.jobsService.findAll(query || {});
  }

  /**
   * Fetches a single job by ID.
   */
  @Query(() => JobTypeGraphQL, { name: 'job' })
  async job(@Args('id') id: string) {
    return this.jobsService.findOne(id);
  }

  /**
   * Create a new job listing.
   *
   * FIXES APPLIED:
   * 1. Authorization: Added GqlRolesGuard and @Roles to restrict access to EMPLOYER/ADMIN.
   * 2. Logic: Correctly extracts user.userId (matches JwtStrategy) instead of .id.
   */
  @Mutation(() => JobTypeGraphQL)
  @UseGuards(GqlAuthGuard, GqlRolesGuard)
  @Roles('EMPLOYER', 'ADMIN')
  async createJob(
    @Args('input') input: CreateJobInput,
    @GqlCurrentUser() user: CurrentUserPayload,
  ) {
    // The JwtStrategy payload uses the key 'userId'
    const userId = user?.userId;

    if (!userId) {
      throw new ForbiddenException(
        'User identification failed. Authentication context missing userId.',
      );
    }

    // Delegate to the service, passing the validated userId
    return this.jobsService.create(userId, input as any);
  }

  /**
   * Field Resolver: company
   * Prevents N+1 by batching requests via CompanyLoader.
   */
  @ResolveField(() => CompanyType, { nullable: true })
  async company(@Parent() job: any) {
    if (job.company) return job.company;
    if (!job.companyId) return null;
    return this.companyLoader.batchLoad.load(job.companyId);
  }

  /**
   * Field Resolver: category
   * Prevents N+1 by batching requests via CategoryLoader.
   */
  @ResolveField(() => JobCategoryType, { nullable: true })
  async category(@Parent() job: any) {
    if (job.category) return job.category;
    if (!job.categoryId) return null;
    return this.categoryLoader.batchLoad.load(job.categoryId);
  }
}