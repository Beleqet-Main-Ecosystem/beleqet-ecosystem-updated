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
exports.CompanyLoader = void 0;
const common_1 = require("@nestjs/common");
const DataLoader = require("dataloader");
const prisma_service_1 = require("../../prisma/prisma.service");
let CompanyLoader = class CompanyLoader {
    constructor(prisma) {
        this.prisma = prisma;
        this.batchLoad = new DataLoader(async (ids) => {
            const companies = await this.prisma.company.findMany({
                where: { id: { in: ids } },
            });
            const map = new Map(companies.map((c) => [c.id, c]));
            return ids.map((id) => map.get(id) || null);
        });
    }
};
exports.CompanyLoader = CompanyLoader;
exports.CompanyLoader = CompanyLoader = __decorate([
    (0, common_1.Injectable)({ scope: common_1.Scope.REQUEST }),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompanyLoader);
//# sourceMappingURL=company.loader.js.map