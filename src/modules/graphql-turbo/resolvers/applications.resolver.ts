import { Resolver, Query, Args, ResolveField, Parent } from '@nestjs/graphql';
import { PrismaService } from '@prisma-client';
import {
  GqlApplication,
  GqlApplicationConnection,
  GqlApplicationFilterInput,
  GqlUser,
  GqlJob,
} from '../dto/graphql-types';
import { createJobLoader, createUserLoader } from '../loaders/dataloaders';

/**
 * GraphQL resolver for Application queries.
 *
 * Provides efficient data fetching for job applications with nested
 * field resolution via DataLoaders.
 *
 * **Performance Benefits**:
 * - `application.user` and `application.job` are batch-resolved via DataLoaders
 * - Single query fetches applications with all needed related data
 * - Clients request only fields they need
 *
 * @example
 * ```graphql
 * query {
 *   applications(filter: { jobId: "uuid" }) {
 *     applications {
 *       id status createdAt
 *       user { firstName lastName email }
 *       job { title company { name } }
 *     }
 *     total
 *   }
 * }
 * ```
 *
 * @remarks GraphQL endpoint: `/graphql` — query `applications`, `application`
 */
@Resolver(() => GqlApplication)
export class ApplicationsResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch applications with filtering and pagination.
   *
   * Supports filtering by status, jobId, and userId with cursor-based
   * pagination for efficient data traversal.
   */
  @Query(() => GqlApplicationConnection, {
    name: 'applications',
    description: 'Fetch applications with filters and pagination',
  })
  async getApplications(@Args('filter', { nullable: true }) filter?: GqlApplicationFilterInput) {
    const page = filter?.page || 1;
    const limit = Math.min(filter?.limit || 20, 100);
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (filter?.status) where.status = filter.status;
    if (filter?.jobId) where.jobId = filter.jobId;
    if (filter?.userId) where.userId = filter.userId;

    const [applications, total] = await Promise.all([
      this.prisma.application.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.application.count({ where }),
    ]);

    return {
      applications,
      total,
      page,
      limit,
    };
  }

  /**
   * Fetch a single application by ID.
   */
  @Query(() => GqlApplication, {
    name: 'application',
    description: 'Fetch a single application by ID',
    nullable: true,
  })
  async getApplication(@Args('id') id: string) {
    return this.prisma.application.findUnique({ where: { id } });
  }

  /**
   * Fetch all applications for a specific job.
   */
  @Query(() => [GqlApplication], {
    name: 'applicationsByJob',
    description: 'Fetch all applications for a specific job',
  })
  async getApplicationsByJob(@Args('jobId') jobId: string) {
    return this.prisma.application.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Resolve the `user` field using DataLoader.
   */
  @ResolveField(() => GqlUser, { name: 'user', nullable: true })
  async resolveUser(@Parent() application: GqlApplication) {
    if (!application.userId) return null;
    const loader = createUserLoader(this.prisma);
    return loader.load(application.userId);
  }

  /**
   * Resolve the `job` field using DataLoader.
   */
  @ResolveField(() => GqlJob, { name: 'job', nullable: true })
  async resolveJob(@Parent() application: GqlApplication) {
    if (!application.jobId) return null;
    const loader = createJobLoader(this.prisma);
    return loader.load(application.jobId);
  }
}
