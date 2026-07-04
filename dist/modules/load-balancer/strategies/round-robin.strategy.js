"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RoundRobinStrategy = void 0;
const common_1 = require("@nestjs/common");
let RoundRobinStrategy = class RoundRobinStrategy {
    constructor() {
        this.name = 'round_robin';
        this.cursor = 0;
    }
    select(backends, _context) {
        if (backends.length === 0)
            return null;
        const selected = backends[this.cursor % backends.length];
        this.cursor = (this.cursor + 1) % backends.length;
        return selected;
    }
    resetCursor() {
        this.cursor = 0;
    }
};
exports.RoundRobinStrategy = RoundRobinStrategy;
exports.RoundRobinStrategy = RoundRobinStrategy = __decorate([
    (0, common_1.Injectable)()
], RoundRobinStrategy);
//# sourceMappingURL=round-robin.strategy.js.map