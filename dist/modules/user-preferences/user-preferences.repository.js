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
exports.UserPreferencesRepository = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
let UserPreferencesRepository = class UserPreferencesRepository {
    constructor(prisma) {
        this.prisma = prisma;
    }
    async findByUserId(userId) {
        return this.prisma.userPreference.findUnique({
            where: { userId },
            select: { theme: true },
        });
    }
    async save(userId, theme) {
        return this.prisma.userPreference.upsert({
            where: { userId },
            create: { userId, theme },
            update: { theme },
            select: { theme: true },
        });
    }
};
exports.UserPreferencesRepository = UserPreferencesRepository;
exports.UserPreferencesRepository = UserPreferencesRepository = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], UserPreferencesRepository);
//# sourceMappingURL=user-preferences.repository.js.map