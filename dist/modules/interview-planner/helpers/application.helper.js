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
exports.ApplicationHelper = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const nestjs_i18n_1 = require("nestjs-i18n");
let ApplicationHelper = class ApplicationHelper {
    constructor(prisma, i18n) {
        this.prisma = prisma;
        this.i18n = i18n;
    }
    async validateInterviewApplication(employerId, applicationId) {
        const application = await this.prisma.application.findUnique({
            where: {
                id: applicationId,
            },
            include: {
                user: true,
                interview: true,
                job: {
                    include: {
                        company: true,
                    },
                },
            },
        });
        if (!application) {
            throw new common_1.NotFoundException(await this.i18n.translate('interview.interview.applicationNotFound'));
        }
        if (application.job.company.userId !== employerId) {
            throw new common_1.ForbiddenException(await this.i18n.translate('interview.interview.forbidden'));
        }
        if (application.interview) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.interview.alreadyScheduled'));
        }
        return application;
    }
};
exports.ApplicationHelper = ApplicationHelper;
exports.ApplicationHelper = ApplicationHelper = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService])
], ApplicationHelper);
//# sourceMappingURL=application.helper.js.map