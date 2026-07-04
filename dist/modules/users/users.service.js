"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UsersService = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const prisma_service_1 = require("../../prisma/prisma.service");
let UsersService = class UsersService {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findById(id) {
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
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return user;
    }
    async update(id, dto) {
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
    async addClientFeedback(userId, feedback) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        const currentFeedback = Array.isArray(user.clientFeedback) ? user.clientFeedback : [];
        currentFeedback.push(feedback);
        return this.prisma.user.update({
            where: { id: userId },
            data: { clientFeedback: currentFeedback },
            select: { id: true, clientFeedback: true },
        });
    }
    async verifySkill(userId, status) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.NotFoundException('User not found');
        return this.prisma.user.update({
            where: { id: userId },
            data: { skillVerified: status },
            select: { id: true, skillVerified: true },
        });
    }
    async createCompany(userId, dto) {
        return this.prisma.company.create({ data: { ...dto, userId } });
    }
    async getCompany(userId) {
        return this.prisma.company.findUnique({
            where: { userId },
            include: { jobs: { take: 5, orderBy: { createdAt: 'desc' } } },
        });
    }
    async getNotifications(userId) {
        return this.prisma.notification.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });
    }
    async markNotificationRead(notificationId, userId) {
        return this.prisma.notification.updateMany({
            where: { id: notificationId, userId },
            data: { read: true },
        });
    }
    async markAllNotificationsRead(userId) {
        return this.prisma.notification.updateMany({
            where: { userId, read: false },
            data: { read: true },
        });
    }
    getSavedJobs(userId) {
        return this.getSavedJobsWithDetails(userId);
    }
    async getSavedJobsWithDetails(userId) {
        const rows = await this.prisma.$queryRaw `
      SELECT "id", "jobId", "createdAt" FROM "saved_jobs"
      WHERE "userId" = ${userId} ORDER BY "createdAt" DESC
    `;
        const jobs = await this.prisma.job.findMany({
            where: { id: { in: rows.map((row) => row.jobId) } },
            include: { company: true, category: true },
        });
        const byId = new Map(jobs.map((job) => [job.id, job]));
        return rows.flatMap((row) => byId.has(row.jobId) ? [{ ...row, job: byId.get(row.jobId) }] : []);
    }
    async saveJob(userId, jobId) {
        const id = (0, crypto_1.randomUUID)();
        await this.prisma.$executeRaw `
      INSERT INTO "saved_jobs" ("id", "userId", "jobId", "createdAt")
      VALUES (${id}, ${userId}, ${jobId}, NOW())
      ON CONFLICT ("userId", "jobId") DO NOTHING
    `;
        return { id, userId, jobId };
    }
    async removeSavedJob(userId, jobId) {
        const count = await this.prisma
            .$executeRaw `DELETE FROM "saved_jobs" WHERE "userId" = ${userId} AND "jobId" = ${jobId}`;
        return { count };
    }
    async getCvDraft(userId) {
        const rows = await this.prisma.$queryRaw `
      SELECT "id", "userId", "data", "updatedAt" FROM "cv_drafts" WHERE "userId" = ${userId} LIMIT 1
    `;
        return rows[0] ?? null;
    }
    async saveCvDraft(userId, data) {
        const id = (0, crypto_1.randomUUID)();
        const json = JSON.stringify(data);
        await this.prisma.$executeRaw `
      INSERT INTO "cv_drafts" ("id", "userId", "data", "createdAt", "updatedAt")
      VALUES (${id}, ${userId}, CAST(${json} AS jsonb), NOW(), NOW())
      ON CONFLICT ("userId") DO UPDATE SET "data" = EXCLUDED."data", "updatedAt" = NOW()
    `;
        return { id, userId, data };
    }
};
exports.UsersService = UsersService;
exports.UsersService = UsersService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UsersService);
//# sourceMappingURL=users.service.js.map