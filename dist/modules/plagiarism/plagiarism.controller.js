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
exports.PlagiarismController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const check_plagiarism_dto_1 = require("./dto/check-plagiarism.dto");
const plagiarism_service_1 = require("./plagiarism.service");
let PlagiarismController = class PlagiarismController {
    constructor(plagiarismService) {
        this.plagiarismService = plagiarismService;
    }
    check(dto) {
        return this.plagiarismService.check(dto);
    }
    getHistory(limit) {
        const parsedLimit = limit ? Math.min(parseInt(limit, 10), 100) : 20;
        return this.plagiarismService.getHistory(parsedLimit);
    }
    getCheckById(checkId) {
        return this.plagiarismService.getCheckById(checkId);
    }
};
exports.PlagiarismController = PlagiarismController;
__decorate([
    (0, common_1.Post)('check'),
    (0, swagger_1.ApiOperation)({ summary: 'Check text for plagiarism against platform and web sources' }),
    openapi.ApiResponse({ status: 201, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [check_plagiarism_dto_1.CheckPlagiarismDto]),
    __metadata("design:returntype", void 0)
], PlagiarismController.prototype, "check", null);
__decorate([
    (0, common_1.Get)('history'),
    (0, swagger_1.ApiOperation)({ summary: 'List recent plagiarism check results' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlagiarismController.prototype, "getHistory", null);
__decorate([
    (0, common_1.Get)('history/:checkId'),
    (0, swagger_1.ApiOperation)({ summary: 'Get a plagiarism check result by ID' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('checkId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], PlagiarismController.prototype, "getCheckById", null);
exports.PlagiarismController = PlagiarismController = __decorate([
    (0, swagger_1.ApiTags)('plagiarism'),
    (0, common_1.Controller)('plagiarism'),
    __metadata("design:paramtypes", [plagiarism_service_1.PlagiarismService])
], PlagiarismController);
//# sourceMappingURL=plagiarism.controller.js.map