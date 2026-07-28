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
exports.DbIndexMasterController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const db_index_master_service_1 = require("./db-index-master.service");
const explain_query_dto_1 = require("./dto/explain-query.dto");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
let DbIndexMasterController = class DbIndexMasterController {
    constructor(service) {
        this.service = service;
    }
    explainQuery(dto) {
        return this.service.explainQuery(dto.sql, dto.params ?? []);
    }
    listIndexes() {
        return this.service.listIndexes();
    }
    unusedIndexes() {
        return this.service.unusedIndexes();
    }
    seqScanTables() {
        return this.service.heavySeqScanTables();
    }
    fullReport() {
        return this.service.fullReport();
    }
};
exports.DbIndexMasterController = DbIndexMasterController;
__decorate([
    (0, common_1.Post)('explain'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({
        summary: 'EXPLAIN ANALYZE a SQL query',
        description: 'Executes EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) and returns the ' +
            'parsed plan with a human-friendly summary and index suggestions. ' +
            'PII string literals are redacted from logged output.',
    }),
    (0, swagger_1.ApiBody)({ type: explain_query_dto_1.ExplainQueryDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Execution plan returned.' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'SQL validation failed.' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthenticated.' }),
    (0, swagger_1.ApiResponse)({ status: 403, description: 'Admin role required.' }),
    openapi.ApiResponse({ status: common_1.HttpStatus.OK, type: Object }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [explain_query_dto_1.ExplainQueryDto]),
    __metadata("design:returntype", void 0)
], DbIndexMasterController.prototype, "explainQuery", null);
__decorate([
    (0, common_1.Get)('indexes'),
    (0, swagger_1.ApiOperation)({ summary: 'List all indexes with usage stats' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Index list returned.' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DbIndexMasterController.prototype, "listIndexes", null);
__decorate([
    (0, common_1.Get)('indexes/unused'),
    (0, swagger_1.ApiOperation)({ summary: 'List unused (zero-scan) indexes' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Unused index list returned.' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DbIndexMasterController.prototype, "unusedIndexes", null);
__decorate([
    (0, common_1.Get)('tables/seq-scans'),
    (0, swagger_1.ApiOperation)({ summary: 'Tables with heavy sequential scans' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Table scan stats returned.' }),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DbIndexMasterController.prototype, "seqScanTables", null);
__decorate([
    (0, common_1.Get)('report'),
    (0, swagger_1.ApiOperation)({ summary: 'Full index health report with suggestions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Full report returned.' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], DbIndexMasterController.prototype, "fullReport", null);
exports.DbIndexMasterController = DbIndexMasterController = __decorate([
    (0, swagger_1.ApiTags)('db-index-master'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin/db-index'),
    __metadata("design:paramtypes", [db_index_master_service_1.DbIndexMasterService])
], DbIndexMasterController);
//# sourceMappingURL=db-index-master.controller.js.map