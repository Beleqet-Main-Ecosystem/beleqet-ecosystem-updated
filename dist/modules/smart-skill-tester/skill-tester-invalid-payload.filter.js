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
exports.SkillTesterInvalidPayloadFilter = void 0;
const common_1 = require("@nestjs/common");
const nestjs_i18n_1 = require("nestjs-i18n");
let SkillTesterInvalidPayloadFilter = class SkillTesterInvalidPayloadFilter {
    constructor(i18n) {
        this.i18n = i18n;
    }
    async catch(exception, host) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse();
        const request = ctx.getRequest();
        const exceptionResponse = exception.getResponse();
        const payload = typeof exceptionResponse === 'object' && exceptionResponse !== null
            ? exceptionResponse
            : {};
        const details = Array.isArray(payload.message)
            ? payload.message.join('; ')
            : typeof payload.message === 'string'
                ? payload.message
                : undefined;
        const fallback = details ?? 'Invalid skill tester payload.';
        const translated = await this.i18n.t('messages.skillTester.invalidPayload', {
            args: { details: fallback },
            defaultValue: fallback,
        });
        response.status(common_1.HttpStatus.BAD_REQUEST).json({
            statusCode: common_1.HttpStatus.BAD_REQUEST,
            errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
            message: typeof translated === 'string' ? translated : fallback,
            timestamp: new Date().toISOString(),
            path: request.url,
        });
    }
};
exports.SkillTesterInvalidPayloadFilter = SkillTesterInvalidPayloadFilter;
exports.SkillTesterInvalidPayloadFilter = SkillTesterInvalidPayloadFilter = __decorate([
    (0, common_1.Injectable)(),
    (0, common_1.Catch)(common_1.BadRequestException),
    __metadata("design:paramtypes", [nestjs_i18n_1.I18nService])
], SkillTesterInvalidPayloadFilter);
//# sourceMappingURL=skill-tester-invalid-payload.filter.js.map