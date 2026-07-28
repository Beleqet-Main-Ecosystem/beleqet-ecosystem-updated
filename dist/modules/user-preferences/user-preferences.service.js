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
exports.UserPreferencesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const user_preferences_repository_1 = require("./user-preferences.repository");
let UserPreferencesService = class UserPreferencesService {
    constructor(userPreferencesRepository) {
        this.userPreferencesRepository = userPreferencesRepository;
    }
    async getThemePreference(userId) {
        const preference = await this.userPreferencesRepository.findByUserId(userId);
        return { theme: preference?.theme ?? client_1.ThemePreference.SYSTEM };
    }
    async updateThemePreference(userId, theme) {
        const updated = await this.userPreferencesRepository.save(userId, theme);
        return { theme: updated.theme };
    }
};
exports.UserPreferencesService = UserPreferencesService;
exports.UserPreferencesService = UserPreferencesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [user_preferences_repository_1.UserPreferencesRepository])
], UserPreferencesService);
//# sourceMappingURL=user-preferences.service.js.map