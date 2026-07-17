import { Resolver, Query, Args, Int } from '@nestjs/graphql';
import { PrismaService } from '@prisma-client';
import { GqlUser } from '../dto/graphql-types';

/**
 * GraphQL resolver for User queries.
 *
 * Provides efficient data fetching for user profiles with selective
 * field resolution.  Clients can request only the fields they need,
 * reducing over-fetching compared to REST endpoints.
 *
 * @example
 * ```graphql
 * query {
 *   gqlUser(id: "uuid") {
 *     id firstName lastName role skills headline
 *   }
 * }
 * ```
 *
 * @remarks GraphQL endpoint: `/graphql` — query `gqlUser`, `gqlUsers`
 */
@Resolver(() => GqlUser)
export class UsersResolver {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetch a user by ID with all profile fields.
   *
   * @param id - User UUID
   */
  @Query(() => GqlUser, { name: 'gqlUser', description: 'Fetch a user by ID', nullable: true })
  async getUser(@Args('id') id: string): Promise<GqlUser | null> {
    return this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        headline: true,
        bio: true,
        location: true,
        skills: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Fetch multiple users with filtering by role.
   *
   * @param role - Optional role filter
   * @param limit - Max users to return (default 20)
   */
  @Query(() => [GqlUser], { name: 'gqlUsers', description: 'Fetch users with optional role filter' })
  async getUsers(
    @Args('role', { type: () => String, nullable: true }) role?: string,
    @Args('limit', { type: () => Int, nullable: true }) limit?: number,
  ): Promise<GqlUser[]> {
    const where: Record<string, unknown> = {};
    if (role) where.role = role;

    return this.prisma.user.findMany({
      where,
      take: Math.min(limit || 20, 100),
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        headline: true,
        bio: true,
        location: true,
        skills: true,
        githubUrl: true,
        linkedinUrl: true,
        portfolioUrl: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
