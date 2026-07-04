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
exports.AdminController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const bcrypt = require("bcryptjs");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const roles_guard_1 = require("../../common/guards/roles.guard");
const roles_decorator_1 = require("../../common/decorators/roles.decorator");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const prisma_service_1 = require("../../prisma/prisma.service");
const bull_1 = require("@nestjs/bull");
const queues_constants_1 = require("../queues/queues.constants");
const email_templates_1 = require("../notifications/email-templates");
const chat_service_1 = require("../chat/chat.service");
var ManagedRole;
(function (ManagedRole) {
    ManagedRole["JOB_SEEKER"] = "JOB_SEEKER";
    ManagedRole["EMPLOYER"] = "EMPLOYER";
    ManagedRole["FREELANCER"] = "FREELANCER";
    ManagedRole["ADMIN"] = "ADMIN";
})(ManagedRole || (ManagedRole = {}));
class CreateUserDto {
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    __metadata("design:type", String)
], CreateUserDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], CreateUserDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], CreateUserDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(8),
    __metadata("design:type", String)
], CreateUserDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsEnum)(ManagedRole),
    __metadata("design:type", String)
], CreateUserDto.prototype, "role", void 0);
class UpdateUserDto {
}
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "firstName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(2),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "lastName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ManagedRole),
    __metadata("design:type", String)
], UpdateUserDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], UpdateUserDto.prototype, "isActive", void 0);
class BroadcastDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(3),
    __metadata("design:type", String)
], BroadcastDto.prototype, "title", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(5),
    __metadata("design:type", String)
], BroadcastDto.prototype, "body", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(ManagedRole),
    __metadata("design:type", String)
], BroadcastDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.IsString)({ each: true }),
    __metadata("design:type", Array)
], BroadcastDto.prototype, "userIds", void 0);
class ResolveDisputeDto {
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MinLength)(10),
    __metadata("design:type", String)
], ResolveDisputeDto.prototype, "resolution", void 0);
const safeUserSelect = {
    id: true,
    email: true,
    firstName: true,
    lastName: true,
    role: true,
    isActive: true,
    emailVerified: true,
    createdAt: true,
};
let AdminController = class AdminController {
    constructor(prisma, chatService, notificationsQueue) {
        this.prisma = prisma;
        this.chatService = chatService;
        this.notificationsQueue = notificationsQueue;
    }
    getUsers() {
        return this.prisma.user.findMany({ select: safeUserSelect, orderBy: { createdAt: 'desc' } });
    }
    async createUser(dto) {
        return this.prisma.user.create({
            data: {
                email: dto.email.toLowerCase().trim(),
                firstName: dto.firstName.trim(),
                lastName: dto.lastName.trim(),
                passwordHash: await bcrypt.hash(dto.password, 12),
                role: dto.role,
            },
            select: safeUserSelect,
        });
    }
    updateUser(id, dto) {
        return this.prisma.user.update({ where: { id }, data: dto, select: safeUserSelect });
    }
    async deleteUser(id, admin) {
        if (id === admin.userId)
            return { deleted: false, reason: 'You cannot delete your own admin account' };
        await this.prisma.user.delete({ where: { id } });
        return { deleted: true };
    }
    getContacts() {
        return this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' } });
    }
    updateContact(id, body) {
        return this.prisma.contactMessage.update({ where: { id }, data: { status: body.status } });
    }
    async broadcast(dto) {
        let users;
        if (dto.userIds && dto.userIds.length > 0) {
            users = await this.prisma.user.findMany({
                where: { id: { in: dto.userIds }, isActive: true },
                select: { id: true, email: true, firstName: true },
            });
        }
        else {
            users = await this.prisma.user.findMany({
                where: { isActive: true, ...(dto.role && { role: dto.role }) },
                select: { id: true, email: true, firstName: true },
            });
        }
        if (users.length === 0) {
            return { delivered: 0 };
        }
        const result = await this.prisma.notification.createMany({
            data: users.map((user) => ({
                userId: user.id,
                channel: 'IN_APP',
                type: 'ADMIN_ANNOUNCEMENT',
                title: dto.title,
                body: dto.body,
            })),
        });
        for (const u of users) {
            (0, email_templates_1.adminAnnouncementEmail)(u.firstName, dto.title, dto.body)
                .then((email) => this.notificationsQueue.add(queues_constants_1.NOTIFICATION_JOBS.SEND_EMAIL, {
                to: u.email,
                subject: dto.title,
                ...email,
            }))
                .catch(() => { });
        }
        return { delivered: result.count };
    }
    getDisputes() {
        return this.prisma.dispute.findMany({
            include: { contract: { include: { freelanceJob: true, client: true, freelancer: true } } },
        });
    }
    resolveDispute(id, dto) {
        return this.prisma.dispute.update({
            where: { id },
            data: { resolution: dto.resolution, resolvedAt: new Date() },
        });
    }
    async getArbitrationDetails(id) {
        const dispute = await this.prisma.dispute.findUnique({
            where: { id },
            include: {
                contract: {
                    include: {
                        freelanceJob: true,
                        client: { select: safeUserSelect },
                        freelancer: { select: safeUserSelect },
                    },
                },
            },
        });
        if (!dispute)
            return null;
        let chatHistory = [];
        const chatRoom = await this.prisma.chatRoom.findUnique({
            where: { contractId: dispute.contractId }
        });
        if (chatRoom) {
            chatHistory = await this.prisma.message.findMany({
                where: { roomId: chatRoom.id },
                orderBy: { createdAt: 'asc' },
                include: { sender: { select: safeUserSelect } }
            });
        }
        return { dispute, chatHistory };
    }
    async exportUserData(userId) {
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            include: {
                company: true,
                applications: true,
                bids: true,
                freelanceJobs: true,
                contractsAsClient: true,
                contractsAsFreelancer: true,
                kycVerification: true,
            },
        });
        return { data: user };
    }
};
exports.AdminController = AdminController;
__decorate([
    (0, common_1.Get)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'List all users' }),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getUsers", null);
__decorate([
    (0, common_1.Post)('users'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a user' }),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [CreateUserDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "createUser", null);
__decorate([
    (0, common_1.Patch)('users/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Update a user' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, UpdateUserDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateUser", null);
__decorate([
    (0, common_1.Delete)('users/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Delete a user without dependent records' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "deleteUser", null);
__decorate([
    (0, common_1.Get)('contacts'),
    openapi.ApiResponse({ status: 200 }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getContacts", null);
__decorate([
    (0, common_1.Patch)('contacts/:id/status'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "updateContact", null);
__decorate([
    (0, common_1.Post)('notifications/broadcast'),
    openapi.ApiResponse({ status: 201 }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [BroadcastDto]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "broadcast", null);
__decorate([
    (0, common_1.Get)('escrow/disputes'),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "getDisputes", null);
__decorate([
    (0, common_1.Patch)('disputes/:id/resolve'),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, ResolveDisputeDto]),
    __metadata("design:returntype", void 0)
], AdminController.prototype, "resolveDispute", null);
__decorate([
    (0, common_1.Get)('disputes/:id/arbitration'),
    (0, swagger_1.ApiOperation)({ summary: 'Get dispute details including chat history for arbitration' }),
    openapi.ApiResponse({ status: 200, type: Object }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "getArbitrationDetails", null);
__decorate([
    (0, common_1.Get)('compliance/gdpr/export/:userId'),
    (0, swagger_1.ApiOperation)({ summary: 'Export user data for GDPR compliance' }),
    openapi.ApiResponse({ status: 200 }),
    __param(0, (0, common_1.Param)('userId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], AdminController.prototype, "exportUserData", null);
exports.AdminController = AdminController = __decorate([
    (0, swagger_1.ApiTags)('admin'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, roles_decorator_1.Roles)('ADMIN'),
    (0, common_1.Controller)('admin'),
    __param(2, (0, bull_1.InjectQueue)(queues_constants_1.QUEUE_NAMES.NOTIFICATIONS)),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        chat_service_1.ChatService, Object])
], AdminController);
//# sourceMappingURL=admin.controller.js.map