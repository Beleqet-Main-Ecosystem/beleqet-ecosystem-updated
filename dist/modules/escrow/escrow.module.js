"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EscrowModule = void 0;
const common_1 = require("@nestjs/common");
const bull_1 = require("@nestjs/bull");
const queues_constants_1 = require("../queues/queues.constants");
const escrow_service_1 = require("./escrow.service");
const escrow_controller_1 = require("./escrow.controller");
const escrow_processor_1 = require("./escrow.processor");
const wallet_module_1 = require("../wallet/wallet.module");
let EscrowModule = class EscrowModule {
};
exports.EscrowModule = EscrowModule;
exports.EscrowModule = EscrowModule = __decorate([
    (0, common_1.Module)({
        imports: [
            bull_1.BullModule.registerQueue({ name: queues_constants_1.QUEUE_NAMES.ESCROW }, { name: queues_constants_1.QUEUE_NAMES.NOTIFICATIONS }),
            wallet_module_1.WalletModule,
        ],
        providers: [escrow_service_1.EscrowService, escrow_processor_1.EscrowProcessor],
        controllers: [escrow_controller_1.EscrowController],
        exports: [escrow_service_1.EscrowService],
    })
], EscrowModule);
//# sourceMappingURL=escrow.module.js.map