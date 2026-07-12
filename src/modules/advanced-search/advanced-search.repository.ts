/**
 * Search Repository Implementation
 *
 * Implements the search data access layer using Prisma.
 * Follows Clean Architecture principles and GDPR compliance.
 */

import { Injectable } from '@nestjs/common';
import { Prisma, UserRole, FreelanceJobStatus, JobStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ISearchRepository,
  SearchCriteria,
  SearchResult,
} from './interfaces/search-repository.interface';
import {
  calculateRatingFromFeedback,
  filterByMinRating,
  paginateResults,
  sortSearchResults,
} from './utils/search-result.utils';
import { convertCurrency } from './utils/currency-converter.utils';
import { DEFAULT_SEARCH_LIMIT, DEFAULT_SEARCH_PAGE } from './constants/search.constants';

const FREELANCER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  headline: true,
  bio: true,
  location: true,
  skills: true,
  avatarUrl: true,
  clientFeedback: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

type FreelancerRecord = Prisma.UserGetPayload<{ select: typeof FREELANCER_SELECT }>;

@Injectable()
export class SearchRepository implements ISearchRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Search for freelancers based on criteria.
   * GDPR: Excludes sensitive fields (passwordHash, email, phone, etc.)
   */
  async searchFreelancers(criteria: SearchCriteria): Promise<SearchResult[]> {
    const page = criteria.page ?? DEFAULT_SEARCH_PAGE;
    const limit = criteria.limit ?? DEFAULT_SEARCH_LIMIT;
    const results = await this.queryFreelancers(criteria);
    const converted = this.convertResultPricesToTarget(results, criteria.currency ?? 'ETB');
    return paginateResults(converted, page, limit);
  }

  /**
   * Search for projects (freelance jobs) based on criteria.
   */
  async searchProjects(criteria: SearchCriteria): Promise<SearchResult[]> {
    const page = criteria.page ?? DEFAULT_SEARCH_PAGE;
    const limit = criteria.limit ?? DEFAULT_SEARCH_LIMIT;
    const results = await this.queryProjects(criteria);
    const converted = this.convertResultPricesToTarget(results, criteria.currency ?? 'ETB');
    return paginateResults(converted, page, limit);
  }

  /**
   * Search for services (mapped to published jobs) based on criteria.
   */
  async searchServices(criteria: SearchCriteria): Promise<SearchResult[]> {
    const page = criteria.page ?? DEFAULT_SEARCH_PAGE;
    const limit = criteria.limit ?? DEFAULT_SEARCH_LIMIT;
    const results = await this.queryServices(criteria);
    const converted = this.convertResultPricesToTarget(results, criteria.currency ?? 'ETB');
    return paginateResults(converted, page, limit);
  }

  private async queryFreelancers(criteria: SearchCriteria): Promise<SearchResult[]> {
    const where = this.buildFreelancerWhere(criteria);
    const sortBy = criteria.sortBy ?? 'relevance';

    const freelancers = await this.prisma.user.findMany({
      where,
      select: FREELANCER_SELECT,
    });

    const results = this.mapFreelancersToResults(freelancers);
    const filtered = filterByMinRating(results, criteria.minRating);
    return sortSearchResults(filtered, sortBy, criteria.keyword);
  }

  private async queryProjects(criteria: SearchCriteria): Promise<SearchResult[]> {
    const where = this.buildProjectWhere(criteria);
    const sortBy = criteria.sortBy ?? 'relevance';

    const projects = await this.prisma.freelanceJob.findMany({
      where,
      include: this.getProjectInclude(),
    });

    const results = this.mapProjectsToResults(projects);
    const filteredByPrice = this.filterResultsByPriceRange(results, criteria);
    return sortSearchResults(filteredByPrice, sortBy, criteria.keyword);
  }

  private async queryServices(criteria: SearchCriteria): Promise<SearchResult[]> {
    const where = this.buildServiceWhere(criteria);
    const sortBy = criteria.sortBy ?? 'relevance';

    const jobs = await this.prisma.job.findMany({
      where,
      include: this.getServiceInclude(),
    });

    const results = this.mapServicesToResults(jobs);
    const filteredByPrice = this.filterResultsByPriceRange(results, criteria);
    return sortSearchResults(filteredByPrice, sortBy, criteria.keyword);
  }

  /**
   * Search across all entity types with unified sorting and pagination.
   */
  async searchAll(criteria: SearchCriteria): Promise<SearchResult[]> {
    const [freelancers, projects, services] = await Promise.all([
      this.queryFreelancers(criteria),
      this.queryProjects(criteria),
      this.queryServices(criteria),
    ]);

    const combined = [...freelancers, ...projects, ...services];
    const filtered = filterByMinRating(combined, criteria.minRating);
    const sorted = sortSearchResults(filtered, criteria.sortBy ?? 'relevance', criteria.keyword);
    const converted = this.convertResultPricesToTarget(sorted, criteria.currency ?? 'ETB');

    return paginateResults(
      converted,
      criteria.page ?? DEFAULT_SEARCH_PAGE,
      criteria.limit ?? DEFAULT_SEARCH_LIMIT,
    );
  }

  /**
   * Get total count for pagination with filters applied.
   */
  async getTotalCount(criteria: SearchCriteria): Promise<number> {
    const entityType = criteria.entityType ?? 'all';

    if (entityType === 'all') {
      const [freelancers, projects, services] = await Promise.all([
        this.countFreelancers(criteria),
        this.countProjects(criteria),
        this.countServices(criteria),
      ]);
      return freelancers + projects + services;
    }

    if (entityType === 'freelancer') {
      return this.countFreelancers(criteria);
    }

    if (entityType === 'project') {
      return this.countProjects(criteria);
    }

    if (entityType === 'service') {
      return this.countServices(criteria);
    }

    return 0;
  }

  /**
   * Collect distinct skills/tags from freelancers, projects, and services.
   */
  async getDistinctSkills(): Promise<string[]> {
    const [freelancers, projects, services] = await Promise.all([
      this.prisma.user.findMany({
        where: { role: UserRole.FREELANCER, isActive: true },
        select: { skills: true },
      }),
      this.prisma.freelanceJob.findMany({
        where: { status: { in: [FreelanceJobStatus.OPEN, FreelanceJobStatus.FUNDED] } },
        select: { skills: true },
      }),
      this.prisma.job.findMany({
        where: { status: JobStatus.PUBLISHED },
        select: { tags: true },
      }),
    ]);

    const skills = new Set<string>();

    for (const freelancer of freelancers) {
      freelancer.skills.forEach((skill) => skills.add(skill));
    }

    for (const project of projects) {
      project.skills.forEach((skill) => skills.add(skill));
    }

    for (const service of services) {
      service.tags.forEach((tag) => skills.add(tag));
    }

    return Array.from(skills).sort((a, b) => a.localeCompare(b));
  }

  private async countFreelancers(criteria: SearchCriteria): Promise<number> {
    const freelancers = await this.queryFreelancers(criteria);
    return freelancers.length;
  }

  private async countProjects(criteria: SearchCriteria): Promise<number> {
    const projects = await this.queryProjects(criteria);
    return projects.length;
  }

  private async countServices(criteria: SearchCriteria): Promise<number> {
    const services = await this.queryServices(criteria);
    return services.length;
  }

  private buildFreelancerWhere(criteria: SearchCriteria): Prisma.UserWhereInput {
    const andConditions: Prisma.UserWhereInput[] = [];

    if (criteria.keyword) {
      andConditions.push({
        OR: [
          { headline: { contains: criteria.keyword, mode: 'insensitive' } },
          { bio: { contains: criteria.keyword, mode: 'insensitive' } },
          { firstName: { contains: criteria.keyword, mode: 'insensitive' } },
          { lastName: { contains: criteria.keyword, mode: 'insensitive' } },
          { skills: { has: criteria.keyword } },
        ],
      });
    }

    if (criteria.skills && criteria.skills.length > 0) {
      andConditions.push({ skills: { hasEvery: criteria.skills } });
    }

    if (criteria.location) {
      andConditions.push({
        location: { contains: criteria.location, mode: 'insensitive' },
      });
    }

    return {
      role: UserRole.FREELANCER,
      isActive: true,
      ...(andConditions.length > 0 ? { AND: andConditions } : {}),
    };
  }

  private buildProjectWhere(criteria: SearchCriteria): Prisma.FreelanceJobWhereInput {
    const andConditions: Prisma.FreelanceJobWhereInput[] = [
      { status: { in: [FreelanceJobStatus.OPEN, FreelanceJobStatus.FUNDED] } },
    ];

    if (criteria.keyword) {
      andConditions.push({
        OR: [
          { title: { contains: criteria.keyword, mode: 'insensitive' } },
          { description: { contains: criteria.keyword, mode: 'insensitive' } },
          { skills: { has: criteria.keyword } },
        ],
      });
    }

    if (criteria.skills && criteria.skills.length > 0) {
      andConditions.push({ skills: { hasEvery: criteria.skills } });
    }

    if (criteria.location) {
      andConditions.push({
        locationPreference: { contains: criteria.location, mode: 'insensitive' },
      });
    }

    return { AND: andConditions };
  }

  private buildServiceWhere(criteria: SearchCriteria): Prisma.JobWhereInput {
    const andConditions: Prisma.JobWhereInput[] = [{ status: JobStatus.PUBLISHED }];

    if (criteria.keyword) {
      andConditions.push({
        OR: [
          { title: { contains: criteria.keyword, mode: 'insensitive' } },
          { description: { contains: criteria.keyword, mode: 'insensitive' } },
          { tags: { has: criteria.keyword } },
        ],
      });
    }

    if (criteria.skills && criteria.skills.length > 0) {
      andConditions.push({ tags: { hasEvery: criteria.skills } });
    }

    if (criteria.location) {
      andConditions.push({
        location: { contains: criteria.location, mode: 'insensitive' },
      });
    }

    return { AND: andConditions };
  }

  private getProjectInclude(): Prisma.FreelanceJobInclude {
    return {
      client: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          avatarUrl: true,
        },
      },
    };
  }

  private getServiceInclude(): Prisma.JobInclude {
    return {
      company: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
        },
      },
    };
  }

  private mapFreelancersToResults(freelancers: FreelancerRecord[]): SearchResult[] {
    return freelancers.map((freelancer) => ({
      id: freelancer.id,
      type: 'freelancer' as const,
      title: freelancer.headline || `${freelancer.firstName} ${freelancer.lastName}`,
      description: freelancer.bio,
      rating: calculateRatingFromFeedback(freelancer.clientFeedback),
      skills: freelancer.skills ?? [],
      location: freelancer.location,
      avatarUrl: freelancer.avatarUrl,
      createdAt: freelancer.createdAt,
    }));
  }

  private mapProjectsToResults(
    projects: Prisma.FreelanceJobGetPayload<{
      include: ReturnType<SearchRepository['getProjectInclude']>;
    }>[],
  ): SearchResult[] {
    return projects.map((project) => ({
      id: project.id,
      type: 'project' as const,
      title: project.title,
      description: project.description,
      price: {
        min: project.budgetMin,
        max: project.budgetMax,
        currency: project.currency,
      },
      skills: project.skills ?? [],
      location: project.locationPreference,
      avatarUrl: project.client.avatarUrl,
      createdAt: project.createdAt,
    }));
  }

  private mapServicesToResults(
    jobs: Prisma.JobGetPayload<{ include: ReturnType<SearchRepository['getServiceInclude']> }>[],
  ): SearchResult[] {
    return jobs.map((job) => ({
      id: job.id,
      type: 'service' as const,
      title: job.title,
      description: job.description,
      price:
        job.salaryMin !== null && job.salaryMax !== null
          ? {
              min: job.salaryMin,
              max: job.salaryMax,
              currency: job.currency,
            }
          : undefined,
      skills: job.tags ?? [],
      location: job.location,
      avatarUrl: job.company.logoUrl,
      createdAt: job.createdAt,
    }));
  }

  /**
   * Filter mapped SearchResults by price range using multi-currency conversion.
   */
  private filterResultsByPriceRange(
    results: SearchResult[],
    criteria: SearchCriteria,
  ): SearchResult[] {
    const targetCurrency = criteria.currency ?? 'ETB';
    const minPrice = criteria.minPrice;
    const maxPrice = criteria.maxPrice;

    if (minPrice === undefined && maxPrice === undefined) {
      return results;
    }

    return results.filter((result) => {
      if (result.type === 'freelancer' || !result.price) {
        return true;
      }

      const itemCurrency = result.price.currency;

      const minConverted =
        result.price.min !== undefined
          ? convertCurrency(result.price.min, itemCurrency, targetCurrency)
          : undefined;
      const maxConverted =
        result.price.max !== undefined
          ? convertCurrency(result.price.max, itemCurrency, targetCurrency)
          : undefined;

      if (minPrice !== undefined && maxConverted !== undefined && maxConverted < minPrice) {
        return false;
      }

      if (maxPrice !== undefined && minConverted !== undefined && minConverted > maxPrice) {
        return false;
      }

      return true;
    });
  }

  /**
   * Convert mapped result prices into the requested target currency.
   */
  private convertResultPricesToTarget(
    results: SearchResult[],
    targetCurrency: string,
  ): SearchResult[] {
    return results.map((result) => {
      if (!result.price || result.price.currency === targetCurrency) {
        return result;
      }

      const originalPrice = result.price;
      const convertedMin =
        originalPrice.min !== undefined
          ? Math.round(convertCurrency(originalPrice.min, originalPrice.currency, targetCurrency))
          : undefined;
      const convertedMax =
        originalPrice.max !== undefined
          ? Math.round(convertCurrency(originalPrice.max, originalPrice.currency, targetCurrency))
          : undefined;

      return {
        ...result,
        price: {
          min: convertedMin,
          max: convertedMax,
          currency: targetCurrency,
        },
      };
    });
  }
}
