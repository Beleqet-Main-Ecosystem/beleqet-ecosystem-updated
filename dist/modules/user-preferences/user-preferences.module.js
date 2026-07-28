"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserPreferencesModule = void 0;
const common_1 = require("@nestjs/common");
const user_preferences_controller_1 = require("./user-preferences.controller");
const user_preferences_repository_1 = require("./user-preferences.repository");
const user_preferences_service_1 = require("./user-preferences.service");
let UserPreferencesModule = class UserPreferencesModule {
};
exports.UserPreferencesModule = UserPreferencesModule;
exports.UserPreferencesModule = UserPreferencesModule = __decorate([
    (0, common_1.Module)({
        controllers: [user_preferences_controller_1.UserPreferencesController],
        providers: [user_preferences_repository_1.UserPreferencesRepository, user_preferences_service_1.UserPreferencesService],
        exports: [user_preferences_service_1.UserPreferencesService],
    })
], UserPreferencesModule);
//# sourceMappingURL=user-preferences.module.js.map