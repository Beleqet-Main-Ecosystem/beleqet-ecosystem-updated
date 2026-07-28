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
exports.AiFeedController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const ai_feed_service_1 = require("./ai-feed.service");
const get_feed_dto_1 = require("./dto/get-feed.dto");
let AiFeedController = class AiFeedController {
    constructor(aiFeedService) {
        this.aiFeedService = aiFeedService;
    }
    async getFeed(query, user) {
        return this.aiFeedService.getPersonalizedFeed(user.userId, query.limit);
    }
};
exports.AiFeedController = AiFeedController;
__decorate([
    (0, common_1.Get)(),
    openapi.ApiResponse({ status: 200, type: [Object] }),
    __param(0, (0, common_1.Query)()),
    __param(1, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [get_feed_dto_1.GetFeedDto, Object]),
    __metadata("design:returntype", Promise)
], AiFeedController.prototype, "getFeed", null);
exports.AiFeedController = AiFeedController = __decorate([
    (0, swagger_1.ApiTags)('ai-feed'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('ai-feed'),
    __metadata("design:paramtypes", [ai_feed_service_1.AiFeedService])
], AiFeedController);
//# sourceMappingURL=ai-feed.controller.js.map