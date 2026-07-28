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
exports.AvailabilityHelper = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
const nestjs_i18n_1 = require("nestjs-i18n");
const client_1 = require("@prisma/client");
let AvailabilityHelper = class AvailabilityHelper {
    constructor(i18n, prisma) {
        this.i18n = i18n;
        this.prisma = prisma;
    }
    async validateAvailability(client, employerId, candidateId, startTime, endTime) {
        const [employerAvailability, candidateAvailability] = await Promise.all([
            client.userAvailability.findFirst({
                where: {
                    userId: employerId,
                    startTime: { lte: startTime },
                    endTime: { gte: endTime },
                },
            }),
            client.userAvailability.findFirst({
                where: {
                    userId: candidateId,
                    startTime: { lte: startTime },
                    endTime: { gte: endTime },
                },
            }),
        ]);
        if (!employerAvailability) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.availability.employerUnavailable'));
        }
        if (!candidateAvailability) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.availability.candidateUnavailable'));
        }
    }
    async validateInterviewConflicts(client, employerId, candidateId, startTime, endTime) {
        const [candidateConflict, employerConflict] = await Promise.all([
            client.interview.findFirst({
                where: {
                    candidateId,
                    status: client_1.InterviewStatus.SCHEDULED,
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                },
            }),
            client.interview.findFirst({
                where: {
                    employerId,
                    status: client_1.InterviewStatus.SCHEDULED,
                    startTime: { lt: endTime },
                    endTime: { gt: startTime },
                },
            }),
        ]);
        if (candidateConflict) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.interview.candidateBusy'));
        }
        if (employerConflict) {
            throw new common_1.ConflictException(await this.i18n.translate('interview.interview.employerBusy'));
        }
    }
    async findEarliestAvailableSlot(commonSlots, employerId, candidateId, durationMinutes) {
        for (const slot of commonSlots) {
            let currentStart = new Date(slot.startTime);
            while (currentStart.getTime() + durationMinutes * 60 * 1000 <= slot.endTime.getTime()) {
                const possibleEnd = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);
                const conflict = await this.prisma.interview.findFirst({
                    where: {
                        status: client_1.InterviewStatus.SCHEDULED,
                        OR: [{ employerId }, { candidateId }],
                        startTime: {
                            lt: possibleEnd,
                        },
                        endTime: {
                            gt: currentStart,
                        },
                    },
                });
                if (!conflict) {
                    return {
                        startTime: currentStart,
                        endTime: possibleEnd,
                        timezone: slot.timezone,
                    };
                }
                currentStart = new Date(currentStart.getTime() + durationMinutes * 60 * 1000);
            }
        }
        return null;
    }
};
exports.AvailabilityHelper = AvailabilityHelper;
exports.AvailabilityHelper = AvailabilityHelper = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [nestjs_i18n_1.I18nService,
        prisma_service_1.PrismaService])
], AvailabilityHelper);
//# sourceMappingURL=availability.helper.js.map