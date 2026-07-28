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
exports.JobsResolver = void 0;
const graphql_1 = require("@nestjs/graphql");
const common_1 = require("@nestjs/common");
const jobs_service_1 = require("./jobs.service");
const job_type_1 = require("./dto/job.type");
const job_input_1 = require("./dto/job.input");
const gql_auth_guard_1 = require("../../graphql/guards/gql-auth.guard");
const gql_roles_guard_1 = require("../../common/guards/gql-roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const gql_current_user_decorator_1 = require("../../common/decorators/gql-current-user.decorator");
const company_loader_1 = require("../../graphql/loaders/company.loader");
const category_loader_1 = require("../../graphql/loaders/category.loader");
let JobsResolver = class JobsResolver {
    constructor(jobsService, companyLoader, categoryLoader) {
        this.jobsService = jobsService;
        this.companyLoader = companyLoader;
        this.categoryLoader = categoryLoader;
    }
    async jobs(query) {
        return this.jobsService.findAll(query || {});
    }
    async job(id) {
        return this.jobsService.findOne(id);
    }
    async createJob(input, user) {
        const userId = user?.userId;
        if (!userId) {
            throw new common_1.ForbiddenException('User ID not found in session context');
        }
        return this.jobsService.create(userId, input);
    }
    async company(job) {
        if (job.company)
            return job.company;
        if (!job.companyId)
            return null;
        return this.companyLoader.batchLoad.load(job.companyId);
    }
    async category(job) {
        if (job.category)
            return job.category;
        if (!job.categoryId)
            return null;
        return this.categoryLoader.batchLoad.load(job.categoryId);
    }
};
exports.JobsResolver = JobsResolver;
__decorate([
    (0, graphql_1.Query)(() => job_type_1.PaginatedJobsType, { name: 'jobs' }),
    __param(0, (0, graphql_1.Args)('query', { type: () => job_input_1.QueryJobsInput, nullable: true })),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [job_input_1.QueryJobsInput]),
    __metadata("design:returntype", Promise)
], JobsResolver.prototype, "jobs", null);
__decorate([
    (0, graphql_1.Query)(() => job_type_1.JobTypeGraphQL, { name: 'job' }),
    __param(0, (0, graphql_1.Args)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], JobsResolver.prototype, "job", null);
__decorate([
    (0, graphql_1.Mutation)(() => job_type_1.JobTypeGraphQL),
    (0, common_1.UseGuards)(gql_auth_guard_1.GqlAuthGuard, gql_roles_guard_1.GqlRolesGuard),
    (0, roles_decorator_1.Roles)('EMPLOYER', 'ADMIN'),
    __param(0, (0, graphql_1.Args)('input')),
    __param(1, (0, gql_current_user_decorator_1.GqlCurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [job_input_1.CreateJobInput, Object]),
    __metadata("design:returntype", Promise)
], JobsResolver.prototype, "createJob", null);
__decorate([
    (0, graphql_1.ResolveField)(() => job_type_1.CompanyType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JobsResolver.prototype, "company", null);
__decorate([
    (0, graphql_1.ResolveField)(() => job_type_1.JobCategoryType, { nullable: true }),
    __param(0, (0, graphql_1.Parent)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], JobsResolver.prototype, "category", null);
exports.JobsResolver = JobsResolver = __decorate([
    (0, graphql_1.Resolver)(() => job_type_1.JobTypeGraphQL),
    __metadata("design:paramtypes", [jobs_service_1.JobsService,
        company_loader_1.CompanyLoader,
        category_loader_1.CategoryLoader])
], JobsResolver);
//# sourceMappingURL=jobs.resolver.js.map