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
exports.ThemePreferenceResponseDto = void 0;
const openapi = require("@nestjs/swagger");
const swagger_1 = require("@nestjs/swagger");
const client_1 = require("@prisma/client");
class ThemePreferenceResponseDto {
    static _OPENAPI_METADATA_FACTORY() {
        return { theme: { required: true, type: () => Object } };
    }
}
exports.ThemePreferenceResponseDto = ThemePreferenceResponseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: client_1.ThemePreference, example: client_1.ThemePreference.SYSTEM }),
    __metadata("design:type", String)
], ThemePreferenceResponseDto.prototype, "theme", void 0);
//# sourceMappingURL=theme-preference-response.dto.js.map