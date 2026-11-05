import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { openJobs } from './open-jobs';
import { alertMatches } from '../job-alerts/job-alert-match';
import { CreateJobDto, JobType, QueryJobsDto, UpdateJobDto } from './dto/create-job.dto';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { jobPostConfirmationEmail, jobAlertEmail } from '../notifications/email-templates';
import { TelegramService } from '../telegram/telegram.service';
import { primaryFrontendUrl } from '../../common/utils/frontend-url';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
    private readonly telegramService: TelegramService,
  ) {}

  /**
   * Job posts allowed and used in the current billing period. Without an active
   * subscription the Free plan applies, counted per calendar month. Every post
   * created in the period counts, so deleting one doesn't give a post back.
   */
  async getQuota(employerId: string) {
    const now = new Date();
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId: employerId,
        status: { in: ['ACTIVE', 'PAST_DUE'] },
        currentPeriodEnd: { gt: now },
      },
      orderBy: { currentPeriodStart: 'desc' },
      include: { plan: true },
    });
    const plan =
      subscription?.plan ??
      (await this.prisma.plan.findFirst({
        where: { priceAmount: 0, isActive: true },
        orderBy: { createdAt: 'asc' },
      }));
    const features = (plan?.features ?? {}) as { maxJobPosts?: number; featuredListing?: boolean };
    const since =
      subscription?.currentPeriodStart ??
      new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const used = await this.prisma.job.count({
      where: { company: { userId: employerId }, createdAt: { gte: since } },
    });
    const limit = features.maxJobPosts ?? (plan ? null : 1);
    return {
      plan: plan?.name ?? 'Free',
      used,
      // -1 or a missing limit means unlimited.
      max: limit === null || limit < 0 ? null : limit,
      canFeature: Boolean(features.featuredListing),
      periodStart: since,
    };
  }

  async create(employerId: string, dto: CreateJobDto) {
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: { firstName: true, email: true, role: true },
    });
    const company = await this.prisma.company.findUnique({ where: { userId: employerId } });
    if (!company) throw new ForbiddenException('Create a company profile before posting jobs');

    if (employer?.role !== 'ADMIN') {
      const quota = await this.getQuota(employerId);
      if (quota.max !== null && quota.used >= quota.max) {
        throw new ForbiddenException(
          `You've used ${quota.max === 1 ? 'your 1 job post' : `all ${quota.max} job posts`} on the ${quota.plan} plan this period. Upgrade to post more.`,
        );
      }
      if (dto.featured && !quota.canFeature) {
        throw new ForbiddenException(
          'Featured listings are included in the Pro and Enterprise plans.',
        );
      }
    }

    const data: any = { ...dto, companyId: company.id, status: dto.status || 'PUBLISHED' };
    if (data.deadline) data.deadline = new Date(data.deadline);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);

    const job = await this.prisma.job.create({
      data,
      include: { company: true, category: true },
    });

    const frontendUrl = primaryFrontendUrl(this.config.get<string>('FRONTEND_URL'));
    const jobUrl = `${frontendUrl}/jobs/${job.id}`;

    // Send confirmation email to Employer
    if (employer) {
      jobPostConfirmationEmail(employer.firstName, job.title, jobUrl)
        .then((email) =>
          this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: employer.email,
            subject: `Your job listing "${job.title}" is live!`,
            ...email,
          }),
        )
        .catch((err) =>
          this.logger.error(`Failed to send job post confirmation email: ${err.message}`),
        );
    }

    // Send Job Alerts to matching job seekers; a draft isn't public yet.
    if (job.status === 'PUBLISHED')
      this.sendJobAlerts(job, jobUrl).catch((err) =>
        this.logger.error(`Failed to send job alerts: ${err.message}`),
      );

    // Broadcast Job to Telegram Channel
    this.telegramService
      .broadcastJob({
        id: job.id,
        title: job.title,
        companyName: job.company?.name,
        location: job.location,
        jobType: job.type,
        salaryMin: job.salaryMin ? Number(job.salaryMin) : undefined,
        salaryMax: job.salaryMax ? Number(job.salaryMax) : undefined,
        currency: job.currency,
      })
      .catch((err) => this.logger.error(`Telegram job broadcast failed: ${err.message}`));

    return job;
  }

  /**
   * Email the people whose job alerts match this job, once each, skipping anyone who turned
   * email off. (This used to email every job seeker about every job.)
   */
  private async sendJobAlerts(job: any, jobUrl: string) {
    const alerts = await this.prisma.jobAlert.findMany({
      where: {
        isActive: true,
        user: { isActive: true, NOT: { notificationPreference: { emailEnabled: false } } },
      },
      include: { user: { select: { id: true, email: true, firstName: true } } },
    });
    const recipients = new Map<string, { email: string; firstName: string }>();
    const matched: string[] = [];
    for (const alert of alerts) {
      if (alert.userId === job.company?.userId || !alertMatches(alert, job)) continue;
      matched.push(alert.id);
      recipients.set(alert.user.id, alert.user);
    }
    if (matched.length) {
      await this.prisma.jobAlert.updateMany({
        where: { id: { in: matched } },
        data: { lastSentAt: new Date() },
      });
    }

    for (const seeker of recipients.values()) {
      jobAlertEmail(seeker.firstName, job.title, job.company.name, jobUrl)
        .then((email) =>
          this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
            to: seeker.email,
            subject: `New Job Opportunity: ${job.title} at ${job.company.name}`,
            ...email,
          }),
        )
        .catch(() => {});
    }
  }

  /**
   * Search suggestions for the landing page, all from the database. Jobs: terms searched by at
   * least 3 different people in the last 30 days (so no one person's searches show), topped up
   * with the most-posted open job titles. Freelance: the commonest skills on open projects.
   */
  async popularSearches(limit = 4) {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [searched, titles, skills] = await Promise.all([
      this.prisma.$queryRaw<{ term: string }[]>`
        SELECT lower(trim("searchTerm")) AS term FROM "search_histories"
        WHERE "searchedAt" >= ${since} AND length(trim("searchTerm")) BETWEEN 2 AND 40
        GROUP BY 1 HAVING count(DISTINCT "userId") >= 3
        ORDER BY count(*) DESC LIMIT ${limit}`,
      this.prisma.job.groupBy({
        by: ['title'],
        where: openJobs(),
        _count: { _all: true },
        orderBy: { _count: { title: 'desc' } },
        take: limit * 2,
      }),
      this.prisma.$queryRaw<{ skill: string }[]>`
        SELECT skill FROM "freelance_jobs", unnest("skills") AS skill
        WHERE "status" IN ('OPEN', 'FUNDED')
        GROUP BY skill ORDER BY count(*) DESC, skill LIMIT ${limit}`,
    ]);
    const jobs = [...searched.map((row) => row.term), ...titles.map((row) => row.title)];
    const unique = [
      ...new Map(jobs.map((term) => [term.trim().toLowerCase(), term.trim()])).values(),
    ];
    return { jobs: unique.slice(0, limit), freelance: skills.map((row) => row.skill) };
  }

  /** Every category, with how many open jobs it has (the website lists the busiest first). */
  async getCategories() {
    const [categories, counts] = await Promise.all([
      this.prisma.jobCategory.findMany({ orderBy: { label: 'asc' } }),
      this.prisma.job.groupBy({ by: ['categoryId'], where: openJobs(), _count: { _all: true } }),
    ]);
    const open = new Map(counts.map((row) => [row.categoryId, row._count._all]));
    return categories.map((category) => ({ ...category, openJobs: open.get(category.id) ?? 0 }));
  }

  /** Public platform statistics shown on the homepage StatsBar. */
  async getPlatformStats() {
    const [activeJobs, hiringCompanies, registeredJobSeekers] = await Promise.all([
      this.prisma.job.count({ where: openJobs() }),
      this.prisma.company.count({ where: { user: { isActive: true } } }),
      this.prisma.user.count({ where: { role: 'JOB_SEEKER', isActive: true } }),
    ]);
    return {
      activeJobs,
      hiringCompanies,
      registeredJobSeekers,
    };
  }

  async findAll(query: QueryJobsDto) {
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
    const { q, category, location, experienceLevel, company, exclude } = query;

    const and: Prisma.JobWhereInput[] = [openJobs()];
    const types = (query.type ?? '')
      .split(',')
      .map((value) => value.trim().toUpperCase())
      .filter((value): value is JobType => (Object.values(JobType) as string[]).includes(value));
    if (types.length) and.push({ type: { in: types } });
    if (category) and.push({ category: { slug: category } });
    if (location) and.push({ location: { contains: location, mode: 'insensitive' } });
    if (experienceLevel)
      and.push({ experienceLevel: { equals: experienceLevel, mode: 'insensitive' } });
    if (company) and.push({ companyId: company });
    if (exclude) and.push({ id: { not: exclude } });
    if (query.salaryMin) {
      and.push({
        OR: [
          { salaryMax: { gte: query.salaryMin } },
          { salaryMax: null, salaryMin: { gte: query.salaryMin } },
        ],
      });
    }
    if (query.postedWithin) {
      and.push({
        createdAt: { gte: new Date(Date.now() - query.postedWithin * 24 * 60 * 60 * 1000) },
      });
    }
    if (q)
      and.push({
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { tags: { has: q } },
        ],
      });
    const where: Prisma.JobWhereInput = { AND: and };
    const orderBy: Prisma.JobOrderByWithRelationInput[] =
      query.sort === 'salary'
        ? [
            { salaryMax: { sort: 'desc', nulls: 'last' } },
            { salaryMin: { sort: 'desc', nulls: 'last' } },
            { createdAt: 'desc' },
          ]
        : [{ featured: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        // Lists show cards, not the full text: descriptions were most of the payload.
        omit: { description: true, requirements: true },
        include: { company: true, category: true, _count: { select: { applications: true } } },
        orderBy,
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      items,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    };
  }

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { company: true, category: true, _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async update(id: string, employerId: string, dto: UpdateJobDto) {
    const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
    if (!job) throw new NotFoundException('Job not found or access denied');
    // Optional fields can be cleared with null; these can only be changed.
    for (const field of ['title', 'description', 'location', 'type', 'categoryId'] as const) {
      if (dto[field] === null) throw new BadRequestException(`${field} can't be empty`);
    }
    if (dto.featured && !job.featured && !(await this.getQuota(employerId)).canFeature) {
      throw new ForbiddenException(
        'Featured listings are included in the Pro and Enterprise plans.',
      );
    }
    const data: any = { ...dto };
    if (data.deadline) data.deadline = new Date(data.deadline);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);
    return this.prisma.job.update({ where: { id }, data });
  }

  async remove(id: string, employerId: string) {
    const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
    if (!job) throw new NotFoundException('Job not found or access denied');
    return this.prisma.job.update({ where: { id }, data: { status: 'ARCHIVED' } });
  }

  async findByCompany(employerId: string) {
    return this.prisma.job.findMany({
      where: { company: { userId: employerId } },
      include: { category: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
