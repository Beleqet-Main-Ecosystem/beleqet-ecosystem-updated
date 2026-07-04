import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto, JobType, QueryJobsDto } from './dto/create-job.dto';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { jobPostConfirmationEmail, jobAlertEmail } from '../notifications/email-templates';
import { RedisCacheService } from '../cache/redis-cache.service';
import { JOBS_LIST_CACHE_REGISTRY_KEY } from '../cache/cache.constants';

type JobAlertPayload = Prisma.JobGetPayload<{ include: { company: true } }>;

interface NormalizedJobsCacheQuery {
  locale: string;
  page: number;
  limit: number;
  q?: string;
  category?: string;
  location?: string;
  type?: JobType;
}

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);
  private readonly jobsCacheTtlMs: number;
  private readonly jobCategoriesCacheTtlMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly cache: RedisCacheService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {
    this.jobsCacheTtlMs = this.getConfiguredTtl('JOBS_CACHE_TTL_MS', 60_000);
    this.jobCategoriesCacheTtlMs = this.getConfiguredTtl('JOB_CATEGORIES_CACHE_TTL_MS', 300_000);
  }

  /**
   * Creates a public job listing and invalidates cached public job lists after persistence.
   */
  async create(employerId: string, dto: CreateJobDto) {
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: { firstName: true, email: true },
    });
    const company = await this.prisma.company.findUnique({ where: { userId: employerId } });
    if (!company) throw new ForbiddenException('Create a company profile before posting jobs');

    const data: Prisma.JobUncheckedCreateInput = {
      ...dto,
      companyId: company.id,
      status: dto.status || 'PUBLISHED',
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    };

    const job = await this.prisma.job.create({
      data,
      include: { company: true, category: true },
    });

    const frontendUrl = this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const jobUrl = `${frontendUrl}/jobs/${job.id}`;

    // Send confirmation email to Employer
    if (employer) {
      jobPostConfirmationEmail(employer.firstName, job.title, jobUrl)
        .then((email) =>
          this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: employer.email,
            subject: `Your job listing "${job.title}" is live!`,
            ...email,
          })
        )
        .catch((err) => this.logger.error(`Failed to send job post confirmation email: ${err.message}`));
    }

    // Send Job Alerts to matching job seekers
    this.sendJobAlerts(job, jobUrl).catch((err) =>
      this.logger.error(`Failed to send job alerts: ${err.message}`)
    );

    await this.invalidatePublicJobListCache();

    return job;
  }

  /**
   * Queues alert emails for active job seekers without blocking the create flow.
   */
  private async sendJobAlerts(job: JobAlertPayload, jobUrl: string): Promise<void> {
    const seekers = await this.prisma.user.findMany({
      where: { role: 'JOB_SEEKER', isActive: true },
      select: { email: true, firstName: true },
    });

    for (const seeker of seekers) {
      jobAlertEmail(seeker.firstName, job.title, job.company.name, jobUrl)
        .then((email) =>
          this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: seeker.email,
            subject: `New Job Opportunity: ${job.title} at ${job.company.name}`,
            ...email,
          })
        )
        .catch(() => {});
    }
  }

  /**
   * Returns cached public job categories for the requested locale.
   */
  async getCategories(locale = 'en') {
    const normalizedLocale = this.normalizeLocale(locale);
    const cacheKey = `jobs:categories:${normalizedLocale}`;

    return this.cache.getOrSet(
      cacheKey,
      () =>
        this.prisma.jobCategory.findMany({
          orderBy: { label: 'asc' },
        }),
      this.jobCategoriesCacheTtlMs,
    );
  }

  /**
   * Returns cached public job search results using a deterministic key from query filters.
   */
  async findAll(query: QueryJobsDto, locale = 'en') {
    const normalizedQuery = this.normalizeJobsQuery(query, locale);
    const cacheKey = this.buildJobsListCacheKey(normalizedQuery);

    return this.cache.getOrSet(
      cacheKey,
      () => this.findAllFromDatabase(normalizedQuery),
      this.jobsCacheTtlMs,
      JOBS_LIST_CACHE_REGISTRY_KEY,
    );
  }

  /**
   * Returns a cached public job detail by id for the requested locale.
   */
  async findOne(id: string, locale = 'en') {
    const normalizedLocale = this.normalizeLocale(locale);
    const cacheKey = this.buildJobDetailCacheKey(id, normalizedLocale);
    const registryKey = this.buildJobDetailRegistryKey(id);

    return this.cache.getOrSet(
      cacheKey,
      () => this.findOneFromDatabase(id),
      this.jobsCacheTtlMs,
      registryKey,
    );
  }

  /**
   * Updates an owned job and invalidates public list/detail caches after persistence.
   */
  async update(id: string, employerId: string, dto: Partial<CreateJobDto>) {
    const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
    if (!job) throw new NotFoundException('Job not found or access denied');

    const updatedJob = await this.prisma.job.update({
      where: { id },
      data: this.buildJobUpdateData(dto),
    });

    await this.invalidatePublicJobCaches(id);

    return updatedJob;
  }

  /**
   * Archives an owned job and invalidates public list/detail caches after persistence.
   */
  async remove(id: string, employerId: string) {
    const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
    if (!job) throw new NotFoundException('Job not found or access denied');

    const archivedJob = await this.prisma.job.update({ where: { id }, data: { status: 'ARCHIVED' } });

    await this.invalidatePublicJobCaches(id);

    return archivedJob;
  }

  /**
   * Returns employer-owned jobs without shared public caching because the data is user-scoped.
   */
  async findByCompany(employerId: string) {
    return this.prisma.job.findMany({
      where: { company: { userId: employerId } },
      include: { category: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Loads public job search results from Prisma when Redis has no matching key.
   */
  private async findAllFromDatabase(query: NormalizedJobsCacheQuery) {
    const pageNum = query.page;
    const limitNum = query.limit;
    const { q, category, location, type } = query;

    // Build a plain where object without Prisma namespace types
    // (avoids Prisma.JobWhereInput which requires generated client)
    const where: Record<string, unknown> = { status: 'PUBLISHED' };
    if (type)     where['type']     = type;
    if (category) where['category'] = { slug: category };
    if (location) where['location'] = { contains: location, mode: 'insensitive' };
    if (q)        where['OR']       = [
      { title:       { contains: q, mode: 'insensitive' } },
      { description: { contains: q, mode: 'insensitive' } },
    ];

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where: where as never,
        include: { company: true, category: true, _count: { select: { applications: true } } },
        orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.job.count({ where: where as never }),
    ]);

    return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
  }

  /**
   * Loads a public job detail from Prisma and throws when the id does not exist.
   */
  private async findOneFromDatabase(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { company: true, category: true, _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  /**
   * Converts patch DTO dates to Prisma-compatible Date objects.
   */
  private buildJobUpdateData(dto: Partial<CreateJobDto>): Prisma.JobUncheckedUpdateInput {
    return {
      ...dto,
      deadline: dto.deadline ? new Date(dto.deadline) : undefined,
      expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : undefined,
    };
  }

  /**
   * Applies query defaults and trims string filters before cache key generation.
   */
  private normalizeJobsQuery(query: QueryJobsDto, locale: string): NormalizedJobsCacheQuery {
    const normalized: NormalizedJobsCacheQuery = {
      locale: this.normalizeLocale(locale),
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 20,
    };

    const q = query.q?.trim();
    const category = query.category?.trim();
    const location = query.location?.trim();

    if (q) normalized.q = q;
    if (category) normalized.category = category;
    if (location) normalized.location = location;
    if (query.type) normalized.type = query.type;

    return normalized;
  }

  /**
   * Builds a short deterministic key for a normalized public job query.
   */
  private buildJobsListCacheKey(query: NormalizedJobsCacheQuery): string {
    const hash = createHash('sha256').update(JSON.stringify(query)).digest('hex');
    return `jobs:list:${hash}`;
  }

  /**
   * Builds the locale-aware cache key for a public job detail.
   */
  private buildJobDetailCacheKey(id: string, locale: string): string {
    return `jobs:detail:${locale}:${id}`;
  }

  /**
   * Builds the registry key for all locale variants of one job detail.
   */
  private buildJobDetailRegistryKey(id: string): string {
    return `jobs:detail:registry:${id}`;
  }

  /**
   * Normalizes request locales so cache keys stay predictable across resolvers.
   */
  private normalizeLocale(locale?: string): string {
    return locale?.trim().toLowerCase() || 'en';
  }

  /**
   * Reads positive TTL values from configuration and falls back to a safe default.
   */
  private getConfiguredTtl(key: string, fallbackMs: number): number {
    const ttl = Number(this.config.get<string | number>(key, fallbackMs));
    return ttl > 0 ? ttl : fallbackMs;
  }

  /**
   * Invalidates all cached public job lists.
   */
  private async invalidatePublicJobListCache(): Promise<void> {
    await this.cache.invalidateRegisteredKeys(JOBS_LIST_CACHE_REGISTRY_KEY);
  }

  /**
   * Invalidates public job lists and all cached locale variants for one job detail.
   */
  private async invalidatePublicJobCaches(id: string): Promise<void> {
    await Promise.all([
      this.invalidatePublicJobListCache(),
      this.cache.invalidateRegisteredKeys(this.buildJobDetailRegistryKey(id)),
    ]);
  }
}
