import { Resolver, Query, Mutation, Args, ResolveField, Parent } from '@nestjs/graphql';
import { UseGuards, ForbiddenException } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobTypeGraphQL, PaginatedJobsType, CompanyType, JobCategoryType } from './dto/job.type';
import { CreateJobInput, QueryJobsInput } from './dto/job.input';

import { GqlAuthGuard } from '../../graphql/guards/gql-auth.guard';
import { GqlRolesGuard } from '../../common/guards/gql-roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { GqlCurrentUser } from '../../common/decorators/gql-current-user.decorator';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

import { CompanyLoader } from '../../graphql/loaders/company.loader';
import { CategoryLoader } from '../../graphql/loaders/category.loader';

@Resolver(() => JobTypeGraphQL)
export class JobsResolver {
  constructor(
    private readonly jobsService: JobsService,
    private readonly companyLoader: CompanyLoader,
    private readonly categoryLoader: CategoryLoader,
  ) {}

  @Query(() => PaginatedJobsType, { name: 'jobs' })
  async jobs(@Args('query', { type: () => QueryJobsInput, nullable: true }) query: QueryJobsInput) {
    return this.jobsService.findAll(query || {});
  }

  @Query(() => JobTypeGraphQL, { name: 'job' })
  async job(@Args('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Mutation(() => JobTypeGraphQL)
  @UseGuards(GqlAuthGuard, GqlRolesGuard) // Fix: Added Guards
  @Roles('EMPLOYER', 'ADMIN') // Fix: Restricted access
  async createJob(
    @Args('input') input: CreateJobInput,
    @GqlCurrentUser() user: CurrentUserPayload,
  ) {
    // FIX: Extracts .userId (populated by JwtStrategy) instead of undefined .id
    const userId = user?.userId;

    if (!userId) {
      throw new ForbiddenException('User ID not found in session context');
    }

    return this.jobsService.create(userId, input as any);
  }

  @ResolveField(() => CompanyType, { nullable: true })
  async company(@Parent() job: any) {
    if (job.company) return job.company;
    if (!job.companyId) return null;
    return this.companyLoader.batchLoad.load(job.companyId);
  }

  @ResolveField(() => JobCategoryType, { nullable: true })
  async category(@Parent() job: any) {
    if (job.category) return job.category;
    if (!job.categoryId) return null;
    return this.categoryLoader.batchLoad.load(job.categoryId);
  }
}
