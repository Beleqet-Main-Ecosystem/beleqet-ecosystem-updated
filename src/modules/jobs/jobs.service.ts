import { Injectable, NotFoundException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateJobDto, QueryJobsDto } from './dto/create-job.dto';
import { QUEUE_NAMES, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { jobPostConfirmationEmail, jobAlertEmail } from '../notifications/email-templates';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS) private readonly notificationsQueue: Queue,
  ) {}

  async create(employerId: string, dto: CreateJobDto) {
    const employer = await this.prisma.user.findUnique({
      where: { id: employerId },
      select: { firstName: true, email: true },
    });
    const company = await this.prisma.company.findUnique({ where: { userId: employerId } });
    if (!company) throw new ForbiddenException('Create a company profile before posting jobs');

    const data: any = { ...dto, companyId: company.id, status: dto.status || 'PUBLISHED' };
    if (data.deadline) data.deadline = new Date(data.deadline);
    if (data.expiryDate) data.expiryDate = new Date(data.expiryDate);

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

    return job;
  }

  private async sendJobAlerts(job: any, jobUrl: string) {
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

  async getCategories() {
    return this.prisma.jobCategory.findMany({
      orderBy: { label: 'asc' },
    });
  }

  async findAll(query: QueryJobsDto) {
    const pageNum = Number(query.page) || 1;
    const limitNum = Number(query.limit) || 20;
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

  async findOne(id: string) {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: { company: true, category: true, _count: { select: { applications: true } } },
    });
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async update(id: string, employerId: string, dto: Partial<CreateJobDto>) {
    const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
    if (!job) throw new NotFoundException('Job not found or access denied');
    return this.prisma.job.update({ where: { id }, data: dto as never });
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
