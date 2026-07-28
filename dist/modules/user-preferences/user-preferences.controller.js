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
exports.UserPreferencesController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const current_user_decorator_1 = require("../../common/decorators/current-user.decorator");
const jwt_auth_guard_1 = require("../../common/guards/jwt-auth.guard");
const update_theme_preference_dto_1 = require("./dto/update-theme-preference.dto");
const user_preferences_service_1 = require("./user-preferences.service");
let UserPreferencesController = class UserPreferencesController {
    constructor(userPreferencesService) {
        this.userPreferencesService = userPreferencesService;
    }
    getThemePreference(user) {
        return this.userPreferencesService.getThemePreference(user.userId);
    }
    updateThemePreference(user, dto) {
        return this.userPreferencesService.updateThemePreference(user.userId, dto.theme);
    }
};
exports.UserPreferencesController = UserPreferencesController;
__decorate([
    (0, common_1.Get)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get the current user theme preference' }),
    openapi.ApiResponse({ status: 200, type: require("./dto/theme-preference-response.dto").ThemePreferenceResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], UserPreferencesController.prototype, "getThemePreference", null);
__decorate([
    (0, common_1.Patch)(),
    (0, swagger_1.ApiOperation)({ summary: 'Update the current user theme preference' }),
    openapi.ApiResponse({ status: 200, type: require("./dto/theme-preference-response.dto").ThemePreferenceResponseDto }),
    __param(0, (0, current_user_decorator_1.CurrentUser)()),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, update_theme_preference_dto_1.UpdateThemePreferenceDto]),
    __metadata("design:returntype", Promise)
], UserPreferencesController.prototype, "updateThemePreference", null);
exports.UserPreferencesController = UserPreferencesController = __decorate([
    (0, swagger_1.ApiTags)('user-preferences'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Controller)('user-preferences/theme'),
    __metadata("design:paramtypes", [user_preferences_service_1.UserPreferencesService])
], UserPreferencesController);
//# sourceMappingURL=user-preferences.controller.js.map