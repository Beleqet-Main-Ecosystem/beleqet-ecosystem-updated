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
var InterviewPlannerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InterviewPlannerService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const nestjs_i18n_1 = require("nestjs-i18n");
const notifications_service_1 = require("../notifications/notifications.service");
const availability_helper_1 = require("./helpers/availability.helper");
const common_availability_helper_1 = require("./helpers/common-availability.helper");
const application_helper_1 = require("./helpers/application.helper");
const date_helper_1 = require("./helpers/date.helper");
const client_1 = require("@prisma/client");
let InterviewPlannerService = InterviewPlannerService_1 = class InterviewPlannerService {
    constructor(prisma, i18n, notificationsService, availabilityHelper, commonAvailabilityHelper, applicationHelper, dateHelper) {
        this.prisma = prisma;
        this.i18n = i18n;
        this.notificationsService = notificationsService;
        this.availabilityHelper = availabilityHelper;
        this.commonAvailabilityHelper = commonAvailabilityHelper;
        this.applicationHelper = applicationHelper;
        this.dateHelper = dateHelper;
        this.logger = new common_1.Logger(InterviewPlannerService_1.name);
    }
    async createAvailability(userId, dto) {
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        await this.dateHelper.validateRange(startTime, endTime);
        const overlappingSlot = await this.prisma.userAvailability.findFirst({
            where: {
                userId,
                startTime: {
                    lt: endTime,
                },
                endTime: {
                    gt: startTime,
                },
            },
        });
        if (overlappingSlot) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.availability.overlap'));
        }
        const availability = await this.prisma.userAvailability.create({
            data: {
                userId,
                startTime,
                endTime,
                timezone: dto.timezone ?? 'UTC',
            },
        });
        return {
            message: await this.i18n.translate('interview.availability.created'),
            data: availability,
        };
    }
    async getUserAvailabilities(userId) {
        return this.prisma.userAvailability.findMany({
            where: {
                userId,
            },
            orderBy: {
                startTime: 'asc',
            },
        });
    }
    async updateAvailability(userId, id, dto) {
        const availability = await this.prisma.userAvailability.findFirst({
            where: {
                id,
                userId,
            },
        });
        if (!availability) {
            throw new common_1.NotFoundException(await this.i18n.translate('interview.availability.notFound'));
        }
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        await this.dateHelper.validateRange(startTime, endTime);
        const overlapping = await this.prisma.userAvailability.findFirst({
            where: {
                userId,
                id: {
                    not: id,
                },
                startTime: {
                    lt: endTime,
                },
                endTime: {
                    gt: startTime,
                },
            },
        });
        if (overlapping) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.availability.overlap'));
        }
        const updatedAvailability = await this.prisma.userAvailability.update({
            where: { id },
            data: {
                startTime,
                endTime,
                timezone: dto.timezone ?? 'UTC',
            },
        });
        return {
            message: await this.i18n.translate('interview.availability.updated'),
            data: updatedAvailability,
        };
    }
    async deleteAvailability(userId, id) {
        const availability = await this.prisma.userAvailability.findFirst({
            where: {
                id,
                userId,
            },
        });
        if (!availability) {
            throw new common_1.NotFoundException(await this.i18n.translate('interview.availability.notFound'));
        }
        await this.prisma.userAvailability.delete({
            where: { id },
        });
        return {
            message: await this.i18n.translate('interview.availability.deleted'),
        };
    }
    async createInterview(employerId, dto) {
        const startTime = new Date(dto.startTime);
        const endTime = new Date(dto.endTime);
        const requestedDurationMinutes = Math.ceil((endTime.getTime() - startTime.getTime()) / 60000);
        await this.dateHelper.validateRange(startTime, endTime);
        const application = await this.applicationHelper.validateInterviewApplication(employerId, dto.applicationId);
        const candidateId = application.userId;
        const interviewDurationMinutes = application.job.interviewDurationMinutes ?? 60;
        if (requestedDurationMinutes !== interviewDurationMinutes) {
            throw new common_1.BadRequestException(await this.i18n.translate('interview.interview.invalidDuration'));
        }
        const interview = await this.prisma.$transaction(async (tx) => {
            await this.availabilityHelper.validateAvailability(tx, employerId, candidateId, startTime, endTime);
            await this.availabilityHelper.validateInterviewConflicts(tx, employerId, candidateId, startTime, endTime);
            const createdInterview = await tx.interview.create({
                data: {
                    applicationId: application.id,
                    employerId,
                    candidateId,
                    startTime,
                    endTime,
                    timezone: dto.timezone ?? 'UTC',
                    notes: dto.notes,
                    durationMinutes: interviewDurationMinutes,
                },
            });
            await tx.application.update({
                where: {
                    id: application.id,
                },
                data: {
                    status: client_1.ApplicationStatus.INTERVIEW_SCHEDULED,
                    interviewSlot: startTime,
                },
            });
            return createdInterview;
        }, {
            isolationLevel: client_1.Prisma.TransactionIsolationLevel.Serializable,
        });
        await this.notificationsService.sendInterviewScheduled(interview.id, employerId, candidateId, application.job.title, interview.startTime, interview.endTime, interview.timezone);
        this.logger.log(`Interview ${interview.id} scheduled by employer ${employerId}`);
        return interview;
    }
    async findCommonAvailability(employerId, candidateId) {
        return this.commonAvailabilityHelper.findCommonAvailability(employerId, candidateId);
    }
    async autoScheduleInterview(employerId, applicationId) {
        const application = await this.applicationHelper.validateInterviewApplication(employerId, applicationId);
        const candidateId = application.userId;
        const interviewDurationMinutes = application.job.interviewDurationMinutes ?? 60;
        const commonSlots = await this.findCommonAvailability(employerId, candidateId);
        if (!commonSlots.length) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.interview.noCommonAvailability'));
        }
        const selectedSlot = await this.availabilityHelper.findEarliestAvailableSlot(commonSlots, employerId, candidateId, interviewDurationMinutes);
        if (!selectedSlot) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.interview.noAvailableSlot'));
        }
        return this.createInterview(employerId, {
            applicationId,
            startTime: selectedSlot.startTime.toISOString(),
            endTime: selectedSlot.endTime.toISOString(),
            timezone: selectedSlot.timezone,
        });
    }
};
exports.InterviewPlannerService = InterviewPlannerService;
exports.InterviewPlannerService = InterviewPlannerService = InterviewPlannerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        nestjs_i18n_1.I18nService,
        notifications_service_1.NotificationsService,
        availability_helper_1.AvailabilityHelper,
        common_availability_helper_1.CommonAvailabilityHelper,
        application_helper_1.ApplicationHelper,
        date_helper_1.DateHelper])
], InterviewPlannerService);
//# sourceMappingURL=interview-planner.service.js.map