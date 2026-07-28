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
exports.CommonAvailabilityHelper = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../prisma/prisma.service");
let CommonAvailabilityHelper = class CommonAvailabilityHelper {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findCommonAvailability(employerId, candidateId) {
        const [employerSlots, candidateSlots] = await Promise.all([
            this.prisma.userAvailability.findMany({
                where: {
                    userId: employerId,
                },
                orderBy: {
                    startTime: 'asc',
                },
            }),
            this.prisma.userAvailability.findMany({
                where: {
                    userId: candidateId,
                },
                orderBy: {
                    startTime: 'asc',
                },
            }),
        ]);
        let employerIndex = 0;
        let candidateIndex = 0;
        const overlaps = [];
        while (employerIndex < employerSlots.length && candidateIndex < candidateSlots.length) {
            const employerSlot = employerSlots[employerIndex];
            const candidateSlot = candidateSlots[candidateIndex];
            const overlapStart = employerSlot.startTime > candidateSlot.startTime
                ? employerSlot.startTime
                : candidateSlot.startTime;
            const overlapEnd = employerSlot.endTime < candidateSlot.endTime ? employerSlot.endTime : candidateSlot.endTime;
            if (overlapStart < overlapEnd) {
                overlaps.push({
                    startTime: overlapStart,
                    endTime: overlapEnd,
                    timezone: employerSlot.timezone,
                });
            }
            if (employerSlot.endTime < candidateSlot.endTime) {
                employerIndex++;
            }
            else {
                candidateIndex++;
            }
        }
        return overlaps;
    }
};
exports.CommonAvailabilityHelper = CommonAvailabilityHelper;
exports.CommonAvailabilityHelper = CommonAvailabilityHelper = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CommonAvailabilityHelper);
//# sourceMappingURL=common-availability.helper.js.map