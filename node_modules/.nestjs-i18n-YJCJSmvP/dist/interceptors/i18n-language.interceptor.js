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
exports.I18nLanguageInterceptor = void 0;
const common_1 = require("@nestjs/common");
const core_1 = require("@nestjs/core");
const rxjs_1 = require("rxjs");
const i18n_constants_1 = require("../i18n.constants");
const i18n_context_1 = require("../i18n.context");
const i18n_service_1 = require("../services/i18n.service");
const utils_1 = require("../utils");
let I18nLanguageInterceptor = class I18nLanguageInterceptor {
    constructor(i18nOptions, i18nResolvers, i18nService, messageFormat, moduleRef) {
        this.i18nOptions = i18nOptions;
        this.i18nResolvers = i18nResolvers;
        this.i18nService = i18nService;
        this.messageFormat = messageFormat;
        this.moduleRef = moduleRef;
    }
    async intercept(context, next) {
        const i18nContext = i18n_context_1.I18nContext.current();
        let language = null;
        const ctx = (0, utils_1.getContextObject)(this.i18nOptions, context);
        const contextType = context.getType();
        const supportedContextTypes = ['http', 'graphql', 'rpc', 'rmq', 'ws'];
        if (!supportedContextTypes.includes(contextType)) {
            return next.handle();
        }
        if (ctx?.i18nLang) {
            return next.handle();
        }
        if (ctx) {
            ctx.i18nService = this.i18nService;
        }
        language = await (0, utils_1.resolveLanguage)(this.i18nResolvers, context, this.moduleRef);
        const resolvedLanguage = (0, utils_1.getLanguageFromResolverResult)(language) || this.i18nOptions.fallbackLanguage;
        if (ctx) {
            ctx.i18nLang = resolvedLanguage;
        }
        const response = context.getType() === 'http'
            ? context.switchToHttp().getResponse()
            : ctx?.res;
        if (response?.locals && ctx?.i18nLang) {
            response.locals.i18nLang = ctx.i18nLang;
        }
        if (!i18nContext) {
            const requestI18nContext = new i18n_context_1.I18nContext(resolvedLanguage, this.i18nService, this.messageFormat);
            if (ctx) {
                ctx.i18nContext = requestI18nContext;
            }
            if (!this.i18nOptions.skipAsyncHook) {
                return new rxjs_1.Observable((observer) => {
                    let subscription;
                    i18n_context_1.I18nContext.createAsync(requestI18nContext, async () => {
                        subscription = next.handle().subscribe(observer);
                    }).catch((error) => {
                        observer.error(error);
                    });
                    return () => {
                        subscription?.unsubscribe();
                    };
                });
            }
        }
        return next.handle();
    }
};
exports.I18nLanguageInterceptor = I18nLanguageInterceptor;
exports.I18nLanguageInterceptor = I18nLanguageInterceptor = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(i18n_constants_1.I18N_OPTIONS)),
    __param(1, (0, common_1.Inject)(i18n_constants_1.I18N_RESOLVERS)),
    __metadata("design:paramtypes", [Object, Array, i18n_service_1.I18nService,
        utils_1.I18nMessageFormat,
        core_1.ModuleRef])
], I18nLanguageInterceptor);
//# sourceMappingURL=i18n-language.interceptor.js.map