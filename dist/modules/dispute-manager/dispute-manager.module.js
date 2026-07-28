"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DisputeManagerModule = void 0;
const common_1 = require("@nestjs/common");
const dispute_manager_service_1 = require("./dispute-manager.service");
const dispute_manager_controller_1 = require("./dispute-manager.controller");
let DisputeManagerModule = class DisputeManagerModule {
};
exports.DisputeManagerModule = DisputeManagerModule;
exports.DisputeManagerModule = DisputeManagerModule = __decorate([
    (0, common_1.Module)({
        controllers: [dispute_manager_controller_1.DisputeManagerController],
        providers: [dispute_manager_service_1.DisputeManagerService],
        exports: [dispute_manager_service_1.DisputeManagerService],
    })
], DisputeManagerModule);
//# sourceMappingURL=dispute-manager.module.js.map