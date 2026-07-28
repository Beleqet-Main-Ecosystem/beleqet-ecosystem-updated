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
exports.PaginatedJobsType = exports.JobTypeGraphQL = exports.CompanyType = exports.JobCategoryType = void 0;
const graphql_1 = require("@nestjs/graphql");
const create_job_dto_1 = require("./create-job.dto");
(0, graphql_1.registerEnumType)(create_job_dto_1.JobType, { name: 'JobType' });
(0, graphql_1.registerEnumType)(create_job_dto_1.JobStatus, { name: 'JobStatus' });
let JobCategoryType = class JobCategoryType {
};
exports.JobCategoryType = JobCategoryType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], JobCategoryType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobCategoryType.prototype, "label", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobCategoryType.prototype, "slug", void 0);
exports.JobCategoryType = JobCategoryType = __decorate([
    (0, graphql_1.ObjectType)()
], JobCategoryType);
let CompanyType = class CompanyType {
};
exports.CompanyType = CompanyType;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], CompanyType.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], CompanyType.prototype, "name", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], CompanyType.prototype, "logo", void 0);
exports.CompanyType = CompanyType = __decorate([
    (0, graphql_1.ObjectType)()
], CompanyType);
let JobTypeGraphQL = class JobTypeGraphQL {
};
exports.JobTypeGraphQL = JobTypeGraphQL;
__decorate([
    (0, graphql_1.Field)(() => graphql_1.ID),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "id", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "title", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "description", void 0);
__decorate([
    (0, graphql_1.Field)({ nullable: true }),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "requirements", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "location", void 0);
__decorate([
    (0, graphql_1.Field)(() => create_job_dto_1.JobType),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "type", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], JobTypeGraphQL.prototype, "salaryMin", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int, { nullable: true }),
    __metadata("design:type", Number)
], JobTypeGraphQL.prototype, "salaryMax", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "currency", void 0);
__decorate([
    (0, graphql_1.Field)(() => create_job_dto_1.JobStatus),
    __metadata("design:type", String)
], JobTypeGraphQL.prototype, "status", void 0);
__decorate([
    (0, graphql_1.Field)(),
    __metadata("design:type", Boolean)
], JobTypeGraphQL.prototype, "featured", void 0);
__decorate([
    (0, graphql_1.Field)(() => Date),
    __metadata("design:type", Date)
], JobTypeGraphQL.prototype, "createdAt", void 0);
__decorate([
    (0, graphql_1.Field)(() => CompanyType, { nullable: true }),
    __metadata("design:type", CompanyType)
], JobTypeGraphQL.prototype, "company", void 0);
__decorate([
    (0, graphql_1.Field)(() => JobCategoryType, { nullable: true }),
    __metadata("design:type", JobCategoryType)
], JobTypeGraphQL.prototype, "category", void 0);
exports.JobTypeGraphQL = JobTypeGraphQL = __decorate([
    (0, graphql_1.ObjectType)()
], JobTypeGraphQL);
let PaginatedJobsType = class PaginatedJobsType {
};
exports.PaginatedJobsType = PaginatedJobsType;
__decorate([
    (0, graphql_1.Field)(() => [JobTypeGraphQL]),
    __metadata("design:type", Array)
], PaginatedJobsType.prototype, "items", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PaginatedJobsType.prototype, "total", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PaginatedJobsType.prototype, "page", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PaginatedJobsType.prototype, "limit", void 0);
__decorate([
    (0, graphql_1.Field)(() => graphql_1.Int),
    __metadata("design:type", Number)
], PaginatedJobsType.prototype, "totalPages", void 0);
exports.PaginatedJobsType = PaginatedJobsType = __decorate([
    (0, graphql_1.ObjectType)()
], PaginatedJobsType);
//# sourceMappingURL=job.type.js.map