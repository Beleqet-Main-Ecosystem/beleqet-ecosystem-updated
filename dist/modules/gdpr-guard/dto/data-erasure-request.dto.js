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
exports.DataErasureRequestDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class DataErasureRequestDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { userId: { required: true, type: () => String }, reason: { required: true, type: () => String } };
    }
}
exports.DataErasureRequestDto = DataErasureRequestDto;
__decorate([
    (0, class_validator_1.IsUUID)('4', { message: 'A valid UUID v4 must be provided for the user ID.' }),
    (0, class_validator_1.IsNotEmpty)({ message: 'User ID is required for GDPR operations.' }),
    __metadata("design:type", String)
], DataErasureRequestDto.prototype, "userId", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)({
        message: 'Reason for data erasure request must be documented for compliance logs.',
    }),
    __metadata("design:type", String)
], DataErasureRequestDto.prototype, "reason", void 0);
//# sourceMappingURL=data-erasure-request.dto.js.map