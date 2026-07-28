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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartSkillTesterController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const nestjs_i18n_1 = require("nestjs-i18n");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const generate_questions_dto_1 = require("./dto/generate-questions.dto");
const submit_answers_dto_1 = require("./dto/submit-answers.dto");
const skill_tester_invalid_payload_filter_1 = require("./skill-tester-invalid-payload.filter");
const smart_skill_tester_service_1 = require("./smart-skill-tester.service");
const skillTesterValidationPipe = new common_1.ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
        const messages = flattenValidationMessages(errors);
        return new common_1.BadRequestException({
            statusCode: common_1.HttpStatus.BAD_REQUEST,
            errorCode: 'ERR_SKILL_TEST_INVALID_PAYLOAD',
            message: messages.join('; ') || 'Invalid skill tester payload.',
        });
    },
});
function flattenValidationMessages(errors, parentPath = '') {
    return errors.flatMap((error) => {
        const propertyPath = parentPath ? `${parentPath}.${error.property}` : error.property;
        const current = error.constraints
            ? Object.values(error.constraints).map((message) => `${propertyPath}: ${message}`)
            : [];
        const nested = error.children?.length
            ? flattenValidationMessages(error.children, propertyPath)
            : [];
        return [...current, ...nested];
    });
}
let SmartSkillTesterController = class SmartSkillTesterController {
    constructor(smartSkillTesterService, i18n) {
        this.smartSkillTesterService = smartSkillTesterService;
        this.i18n = i18n;
    }
    async generate(user, dto) {
        try {
            return await this.smartSkillTesterService.generateSession(user.userId, dto);
        }
        catch (error) {
            throw await this.mapRouteError(error);
        }
    }
    async submit(user, dto) {
        try {
            return await this.smartSkillTesterService.submitAnswers(user.userId, dto);
        }
        catch (error) {
            throw await this.mapRouteError(error);
        }
    }
    async mapRouteError(error) {
        if (error instanceof common_1.UnprocessableEntityException) {
            return this.mapAiGenerationFailed(error);
        }
        if (error instanceof common_1.BadRequestException || error instanceof common_1.HttpException) {
            return error;
        }
        const message = await this.resolveI18nMessage('messages.skillTester.requestFailed', 'Skill tester request failed. Please try again.');
        return new common_1.InternalServerErrorException({
            statusCode: common_1.HttpStatus.INTERNAL_SERVER_ERROR,
            errorCode: 'ERR_SKILL_TEST_REQUEST_FAILED',
            message,
        });
    }
    async mapAiGenerationFailed(error) {
        const response = error.getResponse();
        const payload = typeof response === 'object' && response !== null
            ? response
            : {};
        const errorCode = typeof payload.errorCode === 'string'
            ? payload.errorCode
            : 'ERR_SKILL_TEST_AI_GENERATION_FAILED';
        const message = await this.resolveI18nMessage('messages.skillTester.aiGenerationFailed', 'Failed to generate skill assessment questions. Please try again.');
        return new common_1.UnprocessableEntityException({
            statusCode: common_1.HttpStatus.UNPROCESSABLE_ENTITY,
            errorCode,
            message,
        });
    }
    async resolveI18nMessage(key, defaultValue, args) {
        const translated = await this.i18n.t(key, { args, defaultValue });
        if (typeof translated === 'string') {
            return translated;
        }
        return defaultValue;
    }
};
exports.SmartSkillTesterController = SmartSkillTesterController;
__decorate([
    (0, common_1.Post)('generate'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Generate dynamic skill assessment questions' }),
    (0, swagger_1.ApiBody)({ type: generate_questions_dto_1.GenerateQuestionsDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Generated question set' }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Invalid generate-questions payload',
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Missing or invalid JWT',
    }),
    (0, swagger_1.ApiResponse)({
        status: 422,
        description: 'AI failed to produce a valid question set',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(skillTesterValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, generate_questions_dto_1.GenerateQuestionsDto]),
    __metadata("design:returntype", Promise)
], SmartSkillTesterController.prototype, "generate", null);
__decorate([
    (0, common_1.Post)('submit'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Submit answers for a skill assessment session' }),
    (0, swagger_1.ApiBody)({ type: submit_answers_dto_1.SubmitAnswersDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Graded assessment result' }),
    (0, swagger_1.ApiResponse)({
        status: 400,
        description: 'Invalid submit-answers payload',
    }),
    (0, swagger_1.ApiResponse)({
        status: 401,
        description: 'Missing or invalid JWT',
    }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)(skillTesterValidationPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, submit_answers_dto_1.SubmitAnswersDto]),
    __metadata("design:returntype", Promise)
], SmartSkillTesterController.prototype, "submit", null);
exports.SmartSkillTesterController = SmartSkillTesterController = __decorate([
    (0, swagger_1.ApiTags)('skill-tester'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.UseFilters)(skill_tester_invalid_payload_filter_1.SkillTesterInvalidPayloadFilter),
    (0, common_1.Controller)('skill-tester'),
    __metadata("design:paramtypes", [smart_skill_tester_service_1.SmartSkillTesterService,
        nestjs_i18n_1.I18nService])
], SmartSkillTesterController);
//# sourceMappingURL=smart-skill-tester.controller.js.map