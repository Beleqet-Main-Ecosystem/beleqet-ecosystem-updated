import { Resolver, Query, Args, ResolveField, Parent, Int } from '@nestjs/graphql';
import { PrismaService } from '@prisma-client';
import {
  GqlJob,
  GqlCompany,
  GqlJobCategory,
  GqlJobFilterInput,
  GqlJobConnection,
} from '../dto/graphql-types';
import {
  createCompanyLoader,
  createCategoryLoader,
  createApplicationCountLoader,
} from '../loaders/dataloaders';

/**
 * GraphQL resolver for Job queries and field resolution.
 *
 * Provides efficient data fetching for job listings with filtering,
 * pagination, and nested field resolution via DataLoaders (N+1 prevention).
 *
 * **Performance Benefits over REST**:
 * - Clients request only needed fields (reduced payload)
 * - DataLoaders batch DB queries for nested fields
 * - Single round-trip for complex queries with related data
 *
 * @remarks GraphQL endpoint: `/graphql` — query `jobs`, `job`, `jobsByCompany`
 */
@Resolver(() => GqlJob)
export class JobsResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Query all published jobs with filtering and pagination.
   *
   * @example
   * ```graphql
   * query {
   *   jobs(filter: { type: FULL_TIME, location: "Addis Ababa" }) {
   *     jobs { id title company { name } applicationCount }
   *     total totalPages
   *   }
   * }
   * ```
   */
  @Query(() => GqlJobConnection, {
    name: 'jobs',
    description: 'Fetch jobs with filters and pagination',
  })
  async getJobs(@Args('filter', { nullable: true }) filter?: GqlJobFilterInput) {
    const page = filter?.page || 1;
    const limit = Math.min(filter?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (filter?.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }
    if (filter?.location) {
      where.location = { contains: filter.location, mode: 'insensitive' };
    }
    if (filter?.type) {
      where.type = filter.type;
    }
    if (filter?.status) {
      where.status = filter.status;
    } else {
      // Default to published only
      where.status = 'PUBLISHED';
    }
    if (filter?.categoryId) {
      where.categoryId = filter.categoryId;
    }
    if (filter?.companyId) {
      where.companyId = filter.companyId;
    }
    if (filter?.featured !== undefined) {
      where.featured = filter.featured;
    }
    if (filter?.salaryMin !== undefined || filter?.salaryMax !== undefined) {
      where.AND = where.AND || [];
      if (filter.salaryMin !== undefined) {
        (where.AND as any[]).push({ salaryMax: { gte: filter.salaryMin } });
      }
      if (filter.salaryMax !== undefined) {
        (where.AND as any[]).push({ salaryMin: { lte: filter.salaryMax } });
      }
    }

    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
    };
  }

  /**
   * Query a single job by ID.
   *
   * @example
   * ```graphql
   * query {
   *   job(id: "uuid") {
   *     id title description company { name logoUrl }
   *     category { label } applicationCount
   *   }
   * }
   * ```
   */
  @Query(() => GqlJob, { name: 'job', description: 'Fetch a single job by ID', nullable: true })
  async getJob(@Args('id') id: string) {
    return this.prisma.job.findUnique({ where: { id } });
  }

  /**
   * Query all jobs by a specific company.
   */
  @Query(() => [GqlJob], { name: 'jobsByCompany', description: 'Fetch all jobs for a company' })
  async getJobsByCompany(@Args('companyId') companyId: string) {
    return this.prisma.job.findMany({
      where: { companyId, status: 'PUBLISHED' },
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });
  }

  // ── Field Resolvers (DataLoader-backed) ──────────────────────────────

  /**
   * Resolve the `company` field for a Job using DataLoader.
   *
   * When multiple jobs are resolved in a single GraphQL request, the
   * DataLoader batches all company lookups into one DB query.
   */
  @ResolveField(() => GqlCompany, { name: 'company', nullable: true })
  async resolveCompany(@Parent() job: GqlJob) {
    if (!job.companyId) return null;
    const loader = createCompanyLoader(this.prisma);
    return loader.load(job.companyId);
  }

  /**
   * Resolve the `category` field for a Job using DataLoader.
   */
  @ResolveField(() => GqlJobCategory, { name: 'category', nullable: true })
  async resolveCategory(@Parent() job: GqlJob) {
    if (!job.categoryId) return null;
    const loader = createCategoryLoader(this.prisma);
    return loader.load(job.categoryId);
  }

  /**
   * Resolve the `applicationCount` field for a Job using DataLoader.
   */
  @ResolveField(() => Int, { name: 'applicationCount', nullable: true })
  async resolveApplicationCount(@Parent() job: GqlJob) {
    const loader = createApplicationCountLoader(this.prisma);
    return loader.load(job.id);
  }
}
