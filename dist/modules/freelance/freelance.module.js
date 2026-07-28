"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FreelanceModule = void 0;
const common_1 = require("@nestjs/common");
const freelance_service_1 = require("./freelance.service");
const freelance_controller_1 = require("./freelance.controller");
const escrow_module_1 = require("../escrow/escrow.module");
let FreelanceModule = class FreelanceModule {
};
exports.FreelanceModule = FreelanceModule;
exports.FreelanceModule = FreelanceModule = __decorate([
    (0, common_1.Module)({
        imports: [escrow_module_1.EscrowModule],
        providers: [freelance_service_1.FreelanceService],
        controllers: [freelance_controller_1.FreelanceController],
        exports: [freelance_service_1.FreelanceService],
    })
], FreelanceModule);
//# sourceMappingURL=freelance.module.js.map