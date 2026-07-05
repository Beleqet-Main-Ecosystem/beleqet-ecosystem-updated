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
exports.AcceptLanguageResolver = void 0;
const common_1 = require("@nestjs/common");
const decorators_1 = require("../decorators");
const i18n_constants_1 = require("../i18n.constants");
const accept_language_parser_1 = require("../utils/accept-language-parser");
let AcceptLanguageResolver = class AcceptLanguageResolver {
    constructor(options = {
        matchType: 'strict-loose',
    }) {
        this.options = options;
    }
    async resolve(context) {
        let req;
        let service;
        switch (context.getType()) {
            case i18n_constants_1.ExecutionContextType.HTTP:
                req = context.switchToHttp().getRequest();
                service = req.i18nService;
                break;
            case i18n_constants_1.ExecutionContextType.WS: {
                const client = context.switchToWs().getClient();
                req = client?.handshake ?? client?.upgradeReq ?? client?.request ?? client;
                service = client?.i18nService;
                break;
            }
            case i18n_constants_1.ExecutionContextType.GRAPHQL:
                [, , { req, i18nService: service }] = context.getArgs();
                if (!req)
                    return undefined;
                break;
            default:
                return undefined;
        }
        const lang = req.raw
            ? req.raw.headers?.['accept-language']
            : req?.headers?.['accept-language'];
        if (lang && service) {
            const supportedLangs = service.getSupportedLanguages();
            if (this.options.matchType === 'strict') {
                return (0, accept_language_parser_1.pick)(supportedLangs, lang) ?? undefined;
            }
            else if (this.options.matchType === 'loose') {
                return (0, accept_language_parser_1.pick)(supportedLangs, lang, { loose: true }) ?? undefined;
            }
            return ((0, accept_language_parser_1.pick)(supportedLangs, lang) ??
                (0, accept_language_parser_1.pick)(supportedLangs, lang, { loose: true }) ??
                undefined);
        }
        return lang;
    }
};
exports.AcceptLanguageResolver = AcceptLanguageResolver;
exports.AcceptLanguageResolver = AcceptLanguageResolver = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, decorators_1.I18nResolverOptions)()),
    __metadata("design:paramtypes", [Object])
], AcceptLanguageResolver);
//# sourceMappingURL=accept-language.resolver.js.map