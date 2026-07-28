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
exports.ExplainQueryDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class ExplainQueryDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { sql: { required: true, type: () => String, maxLength: 4000 }, params: { required: false, type: () => [Object] } };
    }
}
exports.ExplainQueryDto = ExplainQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        description: 'SQL statement to run through EXPLAIN ANALYZE.',
        example: "SELECT id, title FROM jobs WHERE status = 'PUBLISHED' ORDER BY created_at DESC LIMIT 20",
        maxLength: 4000,
    }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    (0, class_validator_1.MaxLength)(4000),
    __metadata("design:type", String)
], ExplainQueryDto.prototype, "sql", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Positional query parameters ($1, $2, …).',
        type: [String],
        example: ['PUBLISHED', 20],
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    __metadata("design:type", Array)
], ExplainQueryDto.prototype, "params", void 0);
//# sourceMappingURL=explain-query.dto.js.map