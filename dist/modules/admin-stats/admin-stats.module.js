"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AdminStatsModule = void 0;
const common_1 = require("@nestjs/common");
const admin_stats_service_1 = require("./admin-stats.service");
const admin_stats_controller_1 = require("./admin-stats.controller");
const wallet_module_1 = require("../wallet/wallet.module");
let AdminStatsModule = class AdminStatsModule {
};
exports.AdminStatsModule = AdminStatsModule;
exports.AdminStatsModule = AdminStatsModule = __decorate([
    (0, common_1.Module)({
        imports: [wallet_module_1.WalletModule],
        controllers: [admin_stats_controller_1.AdminStatsController],
        providers: [admin_stats_service_1.AdminStatsService],
        exports: [admin_stats_service_1.AdminStatsService],
    })
], AdminStatsModule);
//# sourceMappingURL=admin-stats.module.js.map