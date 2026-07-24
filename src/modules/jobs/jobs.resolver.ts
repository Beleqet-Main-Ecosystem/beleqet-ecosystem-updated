import { Resolver, Query, Mutation, Args, ResolveField, Parent, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { JobsService } from './jobs.service';
import { JobTypeGraphQL, PaginatedJobsType, CompanyType, JobCategoryType } from './dto/job.type';
import { CreateJobInput, QueryJobsInput } from './dto/job.input';
import { GqlAuthGuard } from '../../graphql/guards/gql-auth.guard';
import { CompanyLoader } from '../../graphql/loaders/company.loader';
import { CategoryLoader } from '../../graphql/loaders/category.loader';

@Resolver(() => JobTypeGraphQL)
export class JobsResolver {
  constructor(
    private readonly jobsService: JobsService,
    private readonly companyLoader: CompanyLoader,
    private readonly categoryLoader: CategoryLoader,
  ) {}

  @Query(() => PaginatedJobsType)
  async jobs(@Args('query', { type: () => QueryJobsInput, nullable: true }) query: QueryJobsInput) {
    return this.jobsService.findAll(query || {});
  }

  @Query(() => JobTypeGraphQL)
  async job(@Args('id') id: string) {
    return this.jobsService.findOne(id);
  }

  @Mutation(() => JobTypeGraphQL)
  @UseGuards(GqlAuthGuard)
  async createJob(
    @Args('input') input: CreateJobInput,
    @Context() ctx: any,
  ) {
    const userId = ctx.req.user.id;
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
