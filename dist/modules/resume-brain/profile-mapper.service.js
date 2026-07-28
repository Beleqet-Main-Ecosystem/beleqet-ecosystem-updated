"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfileMapperService = void 0;
const common_1 = require("@nestjs/common");
let ProfileMapperService = class ProfileMapperService {
    toUserProfile(resume) {
        const out = {};
        const firstName = resume.firstName?.trim();
        const lastName = resume.lastName?.trim();
        const phone = resume.phone?.trim();
        const headline = resume.headline?.trim();
        const bio = resume.summary?.trim();
        const location = resume.location?.trim();
        if (firstName)
            out.firstName = firstName;
        if (lastName)
            out.lastName = lastName;
        if (phone)
            out.phone = phone;
        if (headline)
            out.headline = headline;
        if (bio)
            out.bio = bio;
        if (location)
            out.location = location;
        const skills = (resume.skills ?? []).map((s) => s.trim()).filter((s) => s.length > 0);
        if (skills.length > 0)
            out.skills = skills;
        return out;
    }
};
exports.ProfileMapperService = ProfileMapperService;
exports.ProfileMapperService = ProfileMapperService = __decorate([
    (0, common_1.Injectable)()
], ProfileMapperService);
//# sourceMappingURL=profile-mapper.service.js.map