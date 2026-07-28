"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LinkedInLinkAuthGuard = void 0;
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
let LinkedInLinkAuthGuard = class LinkedInLinkAuthGuard extends (0, passport_1.AuthGuard)('linkedin') {
    getAuthenticateOptions(context) {
        const request = context.switchToHttp().getRequest();
        const token = request.query.token;
        if (typeof token !== 'string' || token.length === 0) {
            throw new common_1.BadRequestException('Missing required "token" query parameter for link confirmation.');
        }
        return { state: `link:${token}` };
    }
};
exports.LinkedInLinkAuthGuard = LinkedInLinkAuthGuard;
exports.LinkedInLinkAuthGuard = LinkedInLinkAuthGuard = __decorate([
    (0, common_1.Injectable)()
], LinkedInLinkAuthGuard);
//# sourceMappingURL=linkedin-link-auth.guard.js.map