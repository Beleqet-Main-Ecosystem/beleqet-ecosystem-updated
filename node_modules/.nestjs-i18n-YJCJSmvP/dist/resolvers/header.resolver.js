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
exports.HeaderResolver = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("../decorators");
const i18n_constants_1 = require("../i18n.constants");
const utils_1 = require("../utils");
let HeaderResolver = class HeaderResolver {
    constructor(keys = []) {
        this.keys = keys;
    }
    resolve(context) {
        let req;
        switch (context.getType()) {
            case i18n_constants_1.ExecutionContextType.HTTP:
                req = context.switchToHttp().getRequest();
                break;
            case i18n_constants_1.ExecutionContextType.WS: {
                const client = context.switchToWs().getClient();
                req = client?.handshake ?? client?.upgradeReq ?? client?.request ?? client;
                break;
            }
            case i18n_constants_1.ExecutionContextType.GRAPHQL:
                [, , { req }] = context.getArgs();
                break;
        }
        let lang = undefined;
        if (req) {
            for (const key of this.keys) {
                if (key === 'accept-language') {
                    utils_1.logger.warn('HeaderResolver does not support RFC4647 Accept-Language header. Please use AcceptLanguageResolver instead.');
                }
                if (req.headers !== undefined && req.headers[key] !== undefined) {
                    lang = req.headers[key];
                    break;
                }
            }
        }
        return lang;
    }
};
exports.HeaderResolver = HeaderResolver;
exports.HeaderResolver = HeaderResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, decorators_1.I18nResolverOptions)()),
    __metadata("design:paramtypes", [Array])
], HeaderResolver);
//# sourceMappingURL=header.resolver.js.map