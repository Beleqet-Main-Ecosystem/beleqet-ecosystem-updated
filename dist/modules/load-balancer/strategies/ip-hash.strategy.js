"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IpHashStrategy = void 0;
const common_1 = require("@nestjs/common");
const ip_hash_util_1 = require("../utils/ip-hash.util");
let IpHashStrategy = class IpHashStrategy {
    constructor() {
        this.name = 'ip_hash';
    }
    select(backends, context) {
        if (backends.length === 0)
            return null;
        const affinityKey = context.sessionId ?? context.clientIp;
        if (!affinityKey) {
            return backends[0];
        }
        const index = (0, ip_hash_util_1.hashToIndex)((0, ip_hash_util_1.hashString)(affinityKey), backends.length);
        return backends[index] ?? null;
    }
};
exports.IpHashStrategy = IpHashStrategy;
exports.IpHashStrategy = IpHashStrategy = __decorate([
    (0, common_1.Injectable)()
], IpHashStrategy);
//# sourceMappingURL=ip-hash.strategy.js.map