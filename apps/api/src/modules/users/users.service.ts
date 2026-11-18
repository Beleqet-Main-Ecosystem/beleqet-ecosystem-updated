import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { isDeliverableEmail } from '../../common/utils/deliverable-email';
import { signInMethods } from './sign-in-methods';
import {
  UpdateUserDto,
  CreateCompanyDto,
  UpdateCompanyDto,
  UpdateNotificationPreferenceDto,
} from './dto/update-user.dto';

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
        gender: true,
        country: true,
        city: true,
        defaultResumeUrl: true,
        portfolioUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        skills: true,
        gdprConsent: true,
        emailVerified: true,
        telegramUsername: true,
        signupMethod: true,
        passwordHash: true,
        oauthAccounts: { select: { provider: true } },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    const { passwordHash, oauthAccounts, ...profile } = user;
    return {
      ...profile,
      // A Telegram-only account has an internal placeholder address; it is never shown.
      email: isDeliverableEmail(user.email) ? user.email : null,
      signInMethods: signInMethods({ passwordHash, telegramId: user.telegramId, oauthAccounts }),
    };
  }

  async update(id: string, dto: UpdateUserDto) {
    const now = new Date();
    // Record when consent to personalisation was given or withdrawn.
    const consent =
      dto.gdprConsent === undefined
        ? {}
        : dto.gdprConsent
          ? { gdprConsentDate: now, gdprConsentRevoked: false, gdprConsentRevokedAt: null }
          : { gdprConsentRevoked: true, gdprConsentRevokedAt: now };
    // The city is the place people see; `location` keeps showing it on older screens.
    const place =
      dto.city !== undefined && dto.location === undefined ? { location: dto.city } : {};
    return this.prisma.user.update({
      where: { id },
      data: { ...dto, ...place, ...consent },
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
        gender: true,
        country: true,
        city: true,
        defaultResumeUrl: true,
        portfolioUrl: true,
        githubUrl: true,
        linkedinUrl: true,
        skills: true,
        gdprConsent: true,
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

  /**
   * Edit the employer's company. Verification checked the name on the trade licence, so a new
   * name drops the badge until it is checked again.
   */
  async updateCompany(userId: string, dto: UpdateCompanyDto) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) throw new NotFoundException('Create your company profile first');
    const renamed = dto.name !== undefined && dto.name.trim() !== company.name;
    if (dto.name !== undefined && !dto.name.trim())
      throw new BadRequestException('Company name cannot be empty');
    return this.prisma.company.update({
      where: { userId },
      data: {
        ...dto,
        name: dto.name?.trim(),
        ...(renamed && company.verified
          ? { verified: false, verificationStatus: 'NONE' as const }
          : {}),
      },
    });
  }

  /** Send the trade licence (already uploaded) for an admin to check. */
  async requestCompanyVerification(userId: string, tradeLicenseUrl: string) {
    const company = await this.prisma.company.findUnique({ where: { userId } });
    if (!company) throw new NotFoundException('Create your company profile first');
    if (company.verified) throw new BadRequestException('Your company is already verified');
    if (company.verificationStatus === 'PENDING')
      throw new BadRequestException('Your licence is already being checked');
    return this.prisma.company.update({
      where: { userId },
      data: {
        tradeLicenseUrl,
        verificationStatus: 'PENDING',
        verificationRequestedAt: new Date(),
        verificationNote: null,
      },
      select: {
        verified: true,
        verificationStatus: true,
        verificationRequestedAt: true,
        verificationNote: true,
      },
    });
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

  async getNotificationPreferences(userId: string) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId },
      update: {},
    });
  }

  async updateNotificationPreferences(userId: string, dto: UpdateNotificationPreferenceDto) {
    return this.prisma.notificationPreference.upsert({
      where: { userId },
      create: { userId, ...dto },
      update: dto,
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

  /** The portfolio builder's data; null when nothing has been saved yet. */
  async getPortfolio(userId: string) {
    const draft = await this.prisma.portfolioDraft.findUnique({
      where: { userId },
      select: { data: true, updatedAt: true },
    });
    return draft ?? null;
  }

  async savePortfolio(userId: string, data: Record<string, unknown>) {
    const json = data as Prisma.InputJsonValue;
    return this.prisma.portfolioDraft.upsert({
      where: { userId },
      update: { data: json },
      create: { userId, data: json },
      select: { data: true, updatedAt: true },
    });
  }
}
