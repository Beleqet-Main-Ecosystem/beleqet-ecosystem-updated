import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { PrismaService } from '@prisma-client';
import { GqlAnalyticsSummary, GqlFreelanceJob } from '../dto/graphql-types';
import { createBidCountLoader } from '../loaders/dataloaders';

/**
 * GraphQL resolver for analytics and freelance job queries.
 *
 * Provides aggregated analytics data and freelance job listings
 * with efficient batch-loading via DataLoaders.
 *
 * @remarks GraphQL endpoint: `/graphql` — query `analyticsSummary`, `freelanceJobs`
 */
@Resolver()
export class AnalyticsResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch platform analytics summary.
   *
   * @example
   * ```graphql
   * query {
   *   analyticsSummary {
   *     totalUsers totalJobs totalApplications
   *     activeJobs totalCompanies averageApplicationsPerJob
   *   }
   * }
   * ```
   */
  @Query(() => GqlAnalyticsSummary, {
    name: 'analyticsSummary',
    description: 'Platform analytics dashboard data',
  })
  async getAnalyticsSummary(): Promise<GqlAnalyticsSummary> {
    const [totalUsers, totalJobs, totalApplications, activeJobs, totalCompanies] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.job.count(),
        this.prisma.application.count(),
        this.prisma.job.count({ where: { status: 'PUBLISHED' } }),
        this.prisma.company.count(),
      ]);

    return {
      totalUsers,
      totalJobs,
      totalApplications,
      activeJobs,
      totalCompanies,
      averageApplicationsPerJob: totalJobs > 0 ? totalApplications / totalJobs : 0,
    };
  }

  /**
   * Fetch freelance jobs with bid counts.
   *
   * @example
   * ```graphql
   * query {
   *   freelanceJobs(limit: 10) {
   *     id title budgetMin budgetMax skills bidCount
   *   }
   * }
   * ```
   */
  @Query(() => [GqlFreelanceJob], {
    name: 'freelanceJobs',
    description: 'Fetch freelance jobs with bid counts',
  })
  async getFreelanceJobs(
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<any[]> {
    const jobs = await this.prisma.freelanceJob.findMany({
      take: Math.min(limit || 20, 100),
      orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
    });

    // Batch-load bid counts
    const loader = createBidCountLoader(this.prisma);
    const bidCounts = await Promise.all(jobs.map((j: { id: string }) => loader.load(j.id)));

    return jobs.map((job: Record<string, unknown>, i: number) => ({
      ...job,
      bidCount: bidCounts[i],
    }));
  }
}
