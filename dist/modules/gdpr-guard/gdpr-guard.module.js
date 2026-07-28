"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GdprGuardModule = void 0;
const common_1 = require("@nestjs/common");
const gdpr_guard_service_1 = require("./gdpr-guard.service");
const gdpr_guard_controller_1 = require("./gdpr-guard.controller");
const prisma_module_1 = require("../../prisma/prisma.module");
let GdprGuardModule = class GdprGuardModule {
};
exports.GdprGuardModule = GdprGuardModule;
exports.GdprGuardModule = GdprGuardModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [gdpr_guard_controller_1.GdprGuardController],
        providers: [gdpr_guard_service_1.GdprGuardService],
        exports: [gdpr_guard_service_1.GdprGuardService],
    })
], GdprGuardModule);
//# sourceMappingURL=gdpr-guard.module.js.map