"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var MockKycProvider_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockKycProvider = void 0;
const common_1 = require("@nestjs/common");
let MockKycProvider = MockKycProvider_1 = class MockKycProvider {
    constructor() {
        this.logger = new common_1.Logger(MockKycProvider_1.name);
    }
    async verify(documentBuffer, faceScanBuffer) {
        this.logger.log('Executing simulated KYC verification (Mock Provider)');
        if (!documentBuffer || documentBuffer.length === 0) {
            return {
                matchScore: 0,
                livenessPassed: false,
                isDocumentValid: false,
                rejectionReason: 'Document image is empty or invalid.',
            };
        }
        if (!faceScanBuffer || faceScanBuffer.length === 0) {
            return {
                matchScore: 0,
                livenessPassed: false,
                isDocumentValid: false,
                rejectionReason: 'Live face scan image is empty or invalid.',
            };
        }
        return {
            matchScore: 92.5,
            livenessPassed: true,
            isDocumentValid: true,
            extractedName: 'Bisrat Freelancer',
            extractedIdNumber: 'ID-8849201A',
        };
    }
};
exports.MockKycProvider = MockKycProvider;
exports.MockKycProvider = MockKycProvider = MockKycProvider_1 = __decorate([
    (0, common_1.Injectable)()
], MockKycProvider);
//# sourceMappingURL=mock-kyc-provider.service.js.map