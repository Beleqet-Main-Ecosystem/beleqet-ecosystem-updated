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
exports.Disable2faDto = exports.ChallengeDto = exports.StepUpDto = exports.BackupCodeDto = exports.VerifyDto = exports.ConfirmEnrollmentDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class ConfirmEnrollmentDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { enrollmentToken: { required: true, type: () => String }, code: { required: true, type: () => String, minLength: 6, maxLength: 6 } };
    }
}
exports.ConfirmEnrollmentDto = ConfirmEnrollmentDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Enrollment token returned from startEnrollment' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ConfirmEnrollmentDto.prototype, "enrollmentToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '6-digit TOTP code from authenticator app' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6),
    __metadata("design:type", String)
], ConfirmEnrollmentDto.prototype, "code", void 0);
class VerifyDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { tempToken: { required: true, type: () => String }, code: { required: true, type: () => String, minLength: 6, maxLength: 6 } };
    }
}
exports.VerifyDto = VerifyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Temporary token from login challenge' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyDto.prototype, "tempToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '6-digit TOTP code' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6),
    __metadata("design:type", String)
], VerifyDto.prototype, "code", void 0);
class BackupCodeDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { tempToken: { required: true, type: () => String }, backupCode: { required: true, type: () => String, minLength: 10, maxLength: 10 } };
    }
}
exports.BackupCodeDto = BackupCodeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Temporary token from login challenge' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], BackupCodeDto.prototype, "tempToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Backup code (10 alphanumeric characters)' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(10, 10),
    __metadata("design:type", String)
], BackupCodeDto.prototype, "backupCode", void 0);
class StepUpDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { stepUpToken: { required: true, type: () => String }, code: { required: true, type: () => String, minLength: 6, maxLength: 6 }, action: { required: false, type: () => String }, resourceId: { required: false, type: () => String } };
    }
}
exports.StepUpDto = StepUpDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Step-up challenge token from sensitive action guard or challenge endpoint',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], StepUpDto.prototype, "stepUpToken", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: '6-digit TOTP code' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6),
    __metadata("design:type", String)
], StepUpDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Optional action type for scoped challenge verification',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StepUpDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Optional resource ID for scoped challenge verification',
        required: false,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], StepUpDto.prototype, "resourceId", void 0);
class ChallengeDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { action: { required: true, type: () => String }, resourceId: { required: false, type: () => String } };
    }
}
exports.ChallengeDto = ChallengeDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'Action type to scope the challenge (e.g. wallet_withdraw, milestone_release)',
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], ChallengeDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Optional resource ID for action-specific scoping', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], ChallengeDto.prototype, "resourceId", void 0);
class Disable2faDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { code: { required: true, type: () => String, minLength: 6, maxLength: 6 } };
    }
}
exports.Disable2faDto = Disable2faDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Current 6-digit TOTP code to confirm disable' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.Length)(6, 6),
    __metadata("design:type", String)
], Disable2faDto.prototype, "code", void 0);
//# sourceMappingURL=two-factor.dto.js.map