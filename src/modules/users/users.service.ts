import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto, CreateCompanyDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        telegramId: true,
        createdAt: true,
        company: true,
        headline: true,
        bio: true,
        location: true,
        defaultResumeUrl: true,
        portfolioUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        skills: true,
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        avatarUrl: true,
        phone: true,
        telegramId: true,
        createdAt: true,
        company: true,
        headline: true,
        bio: true,
        location: true,
        defaultResumeUrl: true,
        portfolioUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        skills: true,
      },
    });
  }

  async addClientFeedback(userId: string, feedback: any) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const currentFeedback = Array.isArray(user.clientFeedback) ? user.clientFeedback : [];
    currentFeedback.push(feedback);

    return this.prisma.user.update({
      where: { id: userId },
      data: { clientFeedback: currentFeedback },
      select: { id: true, clientFeedback: true },
    });
  }

  async verifySkill(userId: string, status: boolean) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.user.update({
      where: { id: userId },
      data: { skillVerified: status },
      select: { id: true, skillVerified: true },
    });
  }

  async createCompany(userId: string, dto: CreateCompanyDto) {
    return this.prisma.company.create({ data: { ...dto, userId } });
  }

  async getCompany(userId: string) {
    return this.prisma.company.findUnique({
      where: { userId },
      include: { jobs: { take: 5, orderBy: { createdAt: 'desc' } } },
    });
  }

  async getNotifications(userId: string) {
    return this.prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async markNotificationRead(notificationId: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id: notificationId, userId },
      data: { read: true },
    });
  }

  async markAllNotificationsRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
  }

  getSavedJobs(userId: string) {
    return this.getSavedJobsWithDetails(userId);
  }

  private async getSavedJobsWithDetails(userId: string) {
    const rows = await this.prisma.$queryRaw<Array<{ id: string; jobId: string; createdAt: Date }>>`
      SELECT "id", "jobId", "createdAt" FROM "saved_jobs"
      WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
    `;
    const jobs = await this.prisma.job.findMany({
      where: { id: { in: rows.map((row: any) => row.jobId) } },
      include: { company: true, category: true },
    });
    const byId = new Map(jobs.map((job: any) => [job.id, job]));
    return rows.flatMap((row: any) =>
      byId.has(row.jobId) ? [{ ...row, job: byId.get(row.jobId)! }] : [],
    );
  }

  async saveJob(userId: string, jobId: string) {
    const id = randomUUID();
    await this.prisma.$executeRaw`
      INSERT INTO "saved_jobs" ("id", "userId", "jobId", "createdAt")
      VALUES (${id}, ${userId}, ${jobId}, NOW())
      ON CONFLICT ("userId", "jobId") DO NOTHING
    `;
    return { id, userId, jobId };
  }

  async removeSavedJob(userId: string, jobId: string) {
    const count = await this.prisma
      .$executeRaw`DELETE FROM "saved_jobs" WHERE "userId" = ${userId} AND "jobId" = ${jobId}`;
    return { count };
  }

  async getCvDraft(userId: string) {
    const rows = await this.prisma.$queryRaw<
      Array<{ id: string; userId: string; data: Record<string, unknown>; updatedAt: Date }>
    >`
      SELECT "id", "userId", "data", "updatedAt" FROM "cv_drafts" WHERE "userId" = ${userId} LIMIT 1
    `;
    return rows[0] ?? null;
  }

  async saveCvDraft(userId: string, data: Record<string, unknown>) {
    const id = randomUUID();
    const json = JSON.stringify(data);
    await this.prisma.$executeRaw`
      INSERT INTO "cv_drafts" ("id", "userId", "data", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, CAST(${json} AS jsonb), NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET "data" = EXCLUDED."data", "updatedAt" = NOW()
    `;
    return { id, userId, data };
  }
}
