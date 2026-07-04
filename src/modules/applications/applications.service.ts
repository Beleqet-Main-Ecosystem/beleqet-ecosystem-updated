import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateApplicationDto } from './dto/create-application.dto';
import { QUEUE_NAMES, APPLICATION_JOBS, ANALYTICS_JOBS, NOTIFICATION_JOBS } from '../queues/queues.constants';
import { ConfigService } from '@nestjs/config';
import { applicationReceivedEmail, applicationStatusEmail } from '../notifications/email-templates';

// eslint-disable-next-line @typescript-eslint/no-explicit-any

@Injectable()
export class ApplicationsService {
  private readonly logger = new Logger(ApplicationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventEmitter: EventEmitter2,
    @InjectQueue(QUEUE_NAMES.APPLICATION)
    private readonly applicationQueue: Queue,
    @InjectQueue(QUEUE_NAMES.ANALYTICS)
    private readonly analyticsQueue: Queue,
    @InjectQueue(QUEUE_NAMES.NOTIFICATIONS)
    private readonly notificationsQueue: Queue,
    private readonly config: ConfigService,
  ) {}

  async submit(userId: string, dto: CreateApplicationDto) {
    const job = await this.prisma.job.findFirst({
      where: { id: dto.jobId, status: 'PUBLISHED' },
      include: { company: true },
    });
    if (!job) {
      throw new NotFoundException(`Job ${dto.jobId} not found or no longer accepting applications`);
    }

    const existing = await this.prisma.application.findUnique({
      where: { jobId_userId: { jobId: dto.jobId, userId } },
    });
    if (existing) {
      throw new ConflictException('You have already applied to this job');
    }

    // Atomic create + event log
    const application = await this.prisma.$transaction(async (tx: any) => {
      const app = await tx.application.create({
        data: {
          jobId: dto.jobId,
          userId,
          coverLetter: dto.coverLetter,
          resumeUrl: dto.resumeUrl,
          portfolioUrl: dto.portfolioUrl,
          expectedSalary: dto.expectedSalary,
          screeningAnswers: dto.screeningAnswers,
          status: 'SUBMITTED',
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          job: { select: { id: true, title: true, companyId: true } },
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'application.submitted',
          entityId: app.id,
          entityType: 'Application',
          payload: {
            applicationId: app.id,
            jobId: dto.jobId,
            userId,
            jobTitle: job.title,
            companyId: job.companyId,
          },
          processedBy: ApplicationsService.name,
        },
      });

      return app;
    });

    // Fire-and-forget: do not await Redis queues so the UI doesn't hang if Redis is down locally.
    this.applicationQueue
      .add(
        APPLICATION_JOBS.SCREEN_CANDIDATE,
        {
          applicationId: application.id,
          userId,
          jobId: dto.jobId,
          jobTitle: job.title,
          jobDescription: job.description,
          jobRequirements: job.requirements,
          coverLetter: dto.coverLetter,
          resumeUrl: dto.resumeUrl,
          companyId: job.companyId,
        },
        { priority: 1 },
      )
      .catch((err) => this.logger.error('Failed to enqueue SCREEN_CANDIDATE', err.message));

    this.applicationQueue
      .add(
        APPLICATION_JOBS.NOTIFY_RECRUITER,
        {
          applicationId: application.id,
          jobId: dto.jobId,
          jobTitle: job.title,
          companyId: job.companyId,
          applicantName: `${application.user.firstName} ${application.user.lastName}`,
        },
        { priority: 2 },
      )
      .catch((err) => this.logger.error('Failed to enqueue NOTIFY_RECRUITER', err.message));

    this.analyticsQueue
      .add(ANALYTICS_JOBS.UPDATE_JOB_STATS, { jobId: dto.jobId })
      .catch((err) => this.logger.error('Failed to enqueue UPDATE_JOB_STATS', err.message));

    const applicationUrl = `${this.config.get('FRONTEND_URL')}/applications`;
    applicationReceivedEmail({
      firstName: application.user.firstName,
      jobTitle: job.title,
      companyName: job.company.name,
      applicationUrl,
    })
      .then((email) =>
        this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
          to: application.user.email,
          subject: `Application received — ${job.title}`,
          ...email,
        }),
      )
      .catch((err) => this.logger.error('Failed to enqueue application confirmation email', err.message));

    this.eventEmitter.emit('application.submitted', {
      applicationId: application.id,
      jobId: dto.jobId,
      userId,
    });

    this.logger.log(`Application ${application.id} submitted — screening queued`);
    return application;
  }

  async findByUser(userId: string) {
    return this.prisma.application.findMany({
      where: { userId },
      include: { job: { include: { company: true } }, score: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByJob(jobId: string, employerId: string) {
    const job = await this.prisma.job.findFirst({
      where: { id: jobId, company: { userId: employerId } },
    });
    if (!job) throw new NotFoundException('Job not found');

    return this.prisma.application.findMany({
      where: { jobId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        score: true,
      },
      orderBy: [{ score: { overallScore: 'desc' } }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const application = await this.prisma.application.findUnique({
      where: { id },
      include: { user: true, job: { include: { company: true } }, score: true },
    });
    if (!application) throw new NotFoundException(`Application ${id} not found`);
    return application;
  }

  async updateStatus(id: string, status: string, employerId: string) {
    // 1. Verify the application exists AND belongs to a job owned by this employer
    const application = await this.prisma.application.findFirst({
      where: { id, job: { company: { userId: employerId } } },
      include: {
        user: { select: { email: true, firstName: true } },
        job: { select: { title: true } },
      },
    });

    if (!application) {
      throw new NotFoundException(
        `Application ${id} not found or you don't have permission to update it`,
      );
    }

    // 2. Update the status
    const updated = await this.prisma.application.update({
      where: { id },
      data: { status: status as never },
    });
    await this.prisma.notification.create({
      data: {
        userId: application.userId,
        channel: 'IN_APP',
        type: 'APPLICATION_STATUS',
        title: 'Application status updated',
        body: `Your application status is now ${status.replaceAll('_', ' ').toLowerCase()}.`,
        metadata: { applicationId: id },
      },
    });

    const email = await applicationStatusEmail({
      firstName: application.user.firstName,
      jobTitle: application.job.title,
      status,
      applicationUrl: `${this.config.get('FRONTEND_URL')}/applications`,
    });
    await this.notificationsQueue.add(NOTIFICATION_JOBS.SEND_EMAIL, {
      to: application.user.email,
      subject: `Application update — ${application.job.title}`,
      ...email,
    });
    return updated;
  }

  async withdraw(id: string, userId: string) {
    const application = await this.prisma.application.findFirst({
      where: { id, userId, status: { in: ['SUBMITTED', 'SCREENING', 'SHORTLISTED'] } },
    });
    if (!application) throw new NotFoundException('Application cannot be withdrawn');
    return this.prisma.application.update({ where: { id }, data: { status: 'WITHDRAWN' } });
  }
}
