import * as DataLoader from 'dataloader';
import { PrismaService } from '@prisma-client';

/**
 * DataLoader factory for batch-loading Company records.
 *
 * Prevents N+1 queries when resolving `Job.company` across a list of jobs.
 * Groups company IDs and fetches them in a single `SELECT ... WHERE id IN (...)`.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, any>
 */
export function createCompanyLoader(prisma: PrismaService) {
  return new DataLoader<string, any>(async (companyIds) => {
    const companies = await prisma.company.findMany({
      where: { id: { in: [...companyIds] } },
    });
    const companyMap = new Map(companies.map((c: any) => [c.id, c]));
    return companyIds.map((id) => companyMap.get(id) ?? new Error(`Company ${id} not found`));
  });
}

/**
 * DataLoader factory for batch-loading JobCategory records.
 *
 * Prevents N+1 queries when resolving `Job.category`.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, any>
 */
export function createCategoryLoader(prisma: PrismaService) {
  return new DataLoader<string, any>(async (categoryIds) => {
    const categories = await prisma.jobCategory.findMany({
      where: { id: { in: [...categoryIds] } },
    });
    const categoryMap = new Map(categories.map((c: any) => [c.id, c]));
    return categoryIds.map((id) => categoryMap.get(id) ?? new Error(`Category ${id} not found`));
  });
}

/**
 * DataLoader factory for batch-loading User records.
 *
 * Prevents N+1 queries when resolving `Application.user`.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, any>
 */
export function createUserLoader(prisma: PrismaService) {
  return new DataLoader<string, any>(async (userIds) => {
    const users = await prisma.user.findMany({
      where: { id: { in: [...userIds] } },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        headline: true,
        bio: true,
        location: true,
        skills: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    return userIds.map((id) => userMap.get(id) ?? new Error(`User ${id} not found`));
  });
}

/**
 * DataLoader factory for batch-loading Job records.
 *
 * Prevents N+1 queries when resolving `Application.job`.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, any>
 */
export function createJobLoader(prisma: PrismaService) {
  return new DataLoader<string, any>(async (jobIds) => {
    const jobs = await prisma.job.findMany({
      where: { id: { in: [...jobIds] } },
    });
    const jobMap = new Map(jobs.map((j: any) => [j.id, j]));
    return jobIds.map((id) => jobMap.get(id) ?? new Error(`Job ${id} not found`));
  });
}

/**
 * DataLoader factory for batch-loading application counts per job.
 *
 * Prevents N+1 queries when resolving `Job.applicationCount`.
 * Counts applications grouped by jobId.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, number>
 */
export function createApplicationCountLoader(prisma: PrismaService) {
  return new DataLoader<string, number>(async (jobIds) => {
    const results = await prisma.application.groupBy({
      by: ['jobId'],
      where: { jobId: { in: [...jobIds] } },
      _count: { id: true },
    });
    const countMap = new Map<string, number>(results.map((r: any) => [r.jobId, r._count.id]));
    return jobIds.map((id) => countMap.get(id) ?? 0);
  });
}

/**
 * DataLoader factory for batch-loading FreelanceJob bid counts.
 *
 * @param prisma - PrismaService instance
 * @returns DataLoader<string, number>
 */
export function createBidCountLoader(prisma: PrismaService) {
  return new DataLoader<string, number>(async (freelanceJobIds) => {
    const results = await prisma.bid.groupBy({
      by: ['freelanceJobId'],
      where: { freelanceJobId: { in: [...freelanceJobIds] } },
      _count: { id: true },
    });
    const countMap = new Map<string, number>(
      results.map((r: any) => [r.freelanceJobId, r._count.id]),
    );
    return freelanceJobIds.map((id) => countMap.get(id) ?? 0);
  });
}
