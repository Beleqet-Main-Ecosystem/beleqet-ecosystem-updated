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
exports.CreateJobInput = exports.QueryJobsInput = void 0;
const graphql_1 = require("@nestjs/graphql");
const create_job_dto_1 = require("./create-job.dto");
const class_validator_1 = require("class-validator");
let QueryJobsInput = class QueryJobsInput {
};
exports.QueryJobsInput = QueryJobsInput;
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryJobsInput.prototype, "q", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryJobsInput.prototype, "category", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], QueryJobsInput.prototype, "location", void 0);
__decorate([
    (0, graphql_1.Field)(() => create_job_dto_1.JobType, { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(create_job_dto_1.JobType),
    __metadata("design:type", String)
], QueryJobsInput.prototype, "type", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QueryJobsInput.prototype, "page", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    __metadata("design:type", Number)
], QueryJobsInput.prototype, "limit", void 0);
exports.QueryJobsInput = QueryJobsInput = __decorate([
    (0, graphql_1.InputType)()
], QueryJobsInput);
let CreateJobInput = class CreateJobInput {
};
exports.CreateJobInput = CreateJobInput;
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CreateJobInput.prototype, "title", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CreateJobInput.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CreateJobInput.prototype, "location", void 0);
__decorate([
    (0, graphql_1.Field)(() => create_job_dto_1.JobType),
    __metadata("design:type", String)
], CreateJobInput.prototype, "type", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], CreateJobInput.prototype, "categoryId", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], CreateJobInput.prototype, "salaryMin", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], CreateJobInput.prototype, "salaryMax", void 0);
exports.CreateJobInput = CreateJobInput = __decorate([
    (0, graphql_1.InputType)()
], CreateJobInput);
//# sourceMappingURL=job.input.js.map