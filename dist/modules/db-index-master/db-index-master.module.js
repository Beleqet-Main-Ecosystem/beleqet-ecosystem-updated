"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DbIndexMasterModule = void 0;
const common_1 = require("@nestjs/common");
const db_index_master_controller_1 = require("./db-index-master.controller");
const db_index_master_service_1 = require("./db-index-master.service");
const prisma_module_1 = require("../../prisma/prisma.module");
let DbIndexMasterModule = class DbIndexMasterModule {
};
exports.DbIndexMasterModule = DbIndexMasterModule;
exports.DbIndexMasterModule = DbIndexMasterModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule],
        controllers: [db_index_master_controller_1.DbIndexMasterController],
        providers: [db_index_master_service_1.DbIndexMasterService],
        exports: [db_index_master_service_1.DbIndexMasterService],
    })
], DbIndexMasterModule);
//# sourceMappingURL=db-index-master.module.js.map