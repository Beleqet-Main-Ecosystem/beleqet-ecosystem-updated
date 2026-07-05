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
var PlatformSourceService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlatformSourceService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const PLATFORM_FETCH_LIMIT = 100;
let PlatformSourceService = PlatformSourceService_1 = class PlatformSourceService {
    constructor(prisma) {
        this.prisma = prisma;
        this.logger = new common_1.Logger(PlatformSourceService_1.name);
    }
    async loadDocuments(excludeEntityId) {
        const [jobs, freelanceJobs, applications, bids, users, companies] = await Promise.all([
            this.prisma.job.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, title: true, description: true, requirements: true },
            }),
            this.prisma.freelanceJob.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, title: true, description: true },
            }),
            this.prisma.application.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                where: { coverLetter: { not: null } },
                select: { id: true, coverLetter: true, job: { select: { title: true } } },
            }),
            this.prisma.bid.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    coverLetter: true,
                    freelanceJob: { select: { title: true } },
                },
            }),
            this.prisma.user.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                where: {
                    OR: [{ bio: { not: null } }, { headline: { not: null } }],
                },
                select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    bio: true,
                    headline: true,
                },
            }),
            this.prisma.company.findMany({
                take: PLATFORM_FETCH_LIMIT,
                orderBy: { updatedAt: 'desc' },
                where: { description: { not: null } },
                select: { id: true, name: true, description: true },
            }),
        ]);
        const documents = [];
        for (const job of jobs) {
            if (job.id === excludeEntityId)
                continue;
            const content = [job.title, job.description, job.requirements]
                .filter(Boolean)
                .join('\n');
            if (content.trim().length > 0) {
                documents.push({
                    id: job.id,
                    entityType: 'Job',
                    title: job.title,
                    content,
                    sourceType: 'platform',
                });
            }
        }
        for (const job of freelanceJobs) {
            if (job.id === excludeEntityId)
                continue;
            const content = `${job.title}\n${job.description}`;
            documents.push({
                id: job.id,
                entityType: 'FreelanceJob',
                title: job.title,
                content,
                sourceType: 'platform',
            });
        }
        for (const application of applications) {
            if (application.id === excludeEntityId || !application.coverLetter)
                continue;
            documents.push({
                id: application.id,
                entityType: 'Application',
                title: application.job.title,
                content: application.coverLetter,
                sourceType: 'platform',
            });
        }
        for (const bid of bids) {
            if (bid.id === excludeEntityId)
                continue;
            documents.push({
                id: bid.id,
                entityType: 'Bid',
                title: bid.freelanceJob.title,
                content: bid.coverLetter,
                sourceType: 'platform',
            });
        }
        for (const user of users) {
            if (user.id === excludeEntityId)
                continue;
            const content = [user.headline, user.bio].filter(Boolean).join('\n');
            if (content.trim().length > 0) {
                documents.push({
                    id: user.id,
                    entityType: 'UserProfile',
                    title: `${user.firstName} ${user.lastName}`,
                    content,
                    sourceType: 'platform',
                });
            }
        }
        for (const company of companies) {
            if (company.id === excludeEntityId || !company.description)
                continue;
            documents.push({
                id: company.id,
                entityType: 'Company',
                title: company.name,
                content: company.description,
                sourceType: 'platform',
            });
        }
        this.logger.debug(`Loaded ${documents.length} platform documents for comparison`);
        return documents;
    }
};
exports.PlatformSourceService = PlatformSourceService;
exports.PlatformSourceService = PlatformSourceService = PlatformSourceService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], PlatformSourceService);
//# sourceMappingURL=platform-source.service.js.map