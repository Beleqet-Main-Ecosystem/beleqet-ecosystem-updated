"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KycModule = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const kyc_controller_1 = require("./kyc.controller");
const kyc_service_1 = require("./kyc.service");
const uploads_module_1 = require("../uploads/uploads.module");
const prisma_module_1 = require("../../prisma/prisma.module");
const mock_kyc_provider_service_1 = require("./providers/mock-kyc-provider.service");
const openai_kyc_provider_service_1 = require("./providers/openai-kyc-provider.service");
let KycModule = class KycModule {
};
exports.KycModule = KycModule;
exports.KycModule = KycModule = __decorate([
    (0, common_1.Module)({
        imports: [prisma_module_1.PrismaModule, config_1.ConfigModule, uploads_module_1.UploadsModule],
        controllers: [kyc_controller_1.KycController],
        providers: [
            kyc_service_1.KycService,
            mock_kyc_provider_service_1.MockKycProvider,
            openai_kyc_provider_service_1.OpenAiKycProvider,
            {
                provide: 'KycProvider',
                useFactory: (config, mockProvider, openAiProvider) => {
                    const apiKey = config.get('OPENAI_API_KEY');
                    if (!apiKey || apiKey === 'dummy_key_for_testing' || apiKey === 'sk-...') {
                        return mockProvider;
                    }
                    return openAiProvider;
                },
                inject: [config_1.ConfigService, mock_kyc_provider_service_1.MockKycProvider, openai_kyc_provider_service_1.OpenAiKycProvider],
            },
        ],
        exports: [kyc_service_1.KycService],
    })
], KycModule);
//# sourceMappingURL=kyc.module.js.map