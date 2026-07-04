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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
var JobsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobsService = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../../prisma/prisma.service");
const queues_constants_1 = require("../queues/queues.constants");
const email_templates_1 = require("../notifications/email-templates");
let JobsService = JobsService_1 = class JobsService {
    constructor(prisma, config, notificationsQueue) {
        this.prisma = prisma;
        this.config = config;
        this.notificationsQueue = notificationsQueue;
        this.logger = new common_1.Logger(JobsService_1.name);
    }
    async create(employerId, dto) {
        const employer = await this.prisma.user.findUnique({
            where: { id: employerId },
            select: { firstName: true, email: true },
        });
        const company = await this.prisma.company.findUnique({ where: { userId: employerId } });
        if (!company)
            throw new common_1.ForbiddenException('Create a company profile before posting jobs');
        const data = { ...dto, companyId: company.id, status: dto.status || 'PUBLISHED' };
        if (data.deadline)
            data.deadline = new Date(data.deadline);
        if (data.expiryDate)
            data.expiryDate = new Date(data.expiryDate);
        const job = await this.prisma.job.create({
            data,
            include: { company: true, category: true },
        });
        const frontendUrl = this.config.get('FRONTEND_URL') ?? 'http://localhost:3000';
        const jobUrl = `${frontendUrl}/jobs/${job.id}`;
        if (employer) {
            (0, email_templates_1.jobPostConfirmationEmail)(employer.firstName, job.title, jobUrl)
                .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: employer.email,
                subject: `Your job listing "${job.title}" is live!`,
                ...email,
            }))
                .catch((err) => this.logger.error(`Failed to send job post confirmation email: ${err.message}`));
        }
        this.sendJobAlerts(job, jobUrl).catch((err) => this.logger.error(`Failed to send job alerts: ${err.message}`));
        return job;
    }
    async sendJobAlerts(job, jobUrl) {
        const seekers = await this.prisma.user.findMany({
            where: { role: 'JOB_SEEKER', isActive: true },
            select: { email: true, firstName: true },
        });
        for (const seeker of seekers) {
            (0, email_templates_1.jobAlertEmail)(seeker.firstName, job.title, job.company.name, jobUrl)
                .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: seeker.email,
                subject: `New Job Opportunity: ${job.title} at ${job.company.name}`,
                ...email,
            }))
                .catch(() => { });
        }
    }
    async getCategories() {
        return this.prisma.jobCategory.findMany({
            orderBy: { label: 'asc' },
        });
    }
    async findAll(query) {
        const pageNum = Number(query.page) || 1;
        const limitNum = Number(query.limit) || 20;
        const { q, category, location, type } = query;
        const where = { status: 'PUBLISHED' };
        if (type)
            where['type'] = type;
        if (category)
            where['category'] = { slug: category };
        if (location)
            where['location'] = { contains: location, mode: 'insensitive' };
        if (q)
            where['OR'] = [
                { title: { contains: q, mode: 'insensitive' } },
                { description: { contains: q, mode: 'insensitive' } },
            ];
        const [items, total] = await Promise.all([
            this.prisma.job.findMany({
                where: where,
                include: { company: true, category: true, _count: { select: { applications: true } } },
                orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }],
                skip: (pageNum - 1) * limitNum,
                take: limitNum,
            }),
            this.prisma.job.count({ where: where }),
        ]);
        return { items, total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) };
    }
    async findOne(id) {
        const job = await this.prisma.job.findUnique({
            where: { id },
            include: { company: true, category: true, _count: { select: { applications: true } } },
        });
        if (!job)
            throw new common_1.NotFoundException(`Job ${id} not found`);
        return job;
    }
    async update(id, employerId, dto) {
        const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
        if (!job)
            throw new common_1.NotFoundException('Job not found or access denied');
        return this.prisma.job.update({ where: { id }, data: dto });
    }
    async remove(id, employerId) {
        const job = await this.prisma.job.findFirst({ where: { id, company: { userId: employerId } } });
        if (!job)
            throw new common_1.NotFoundException('Job not found or access denied');
        return this.prisma.job.update({ where: { id }, data: { status: 'ARCHIVED' } });
    }
    async findByCompany(employerId) {
        return this.prisma.job.findMany({
            where: { company: { userId: employerId } },
            include: { category: true, _count: { select: { applications: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }
};
exports.JobsService = JobsService;
exports.JobsService = JobsService = JobsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bull_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        config_1.ConfigService, Object])
], JobsService);
//# sourceMappingURL=jobs.service.js.map