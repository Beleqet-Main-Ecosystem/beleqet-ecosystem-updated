"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nValidationExceptionFilter = void 0;
const common_1 = require("@nestjs/common");
const i18n_context_1 = require("../i18n.context");
const interfaces_1 = require("../interfaces");
const utils_1 = require("../utils");
const i18n_constants_1 = require("../i18n.constants");
let I18nValidationExceptionFilter = class I18nValidationExceptionFilter {
    constructor(options = {
        detailedErrors: true,
    }) {
        this.options = options;
    }
    catch(exception, host) {
        const errors = exception.errorsAlreadyTranslated && exception.errors
            ? exception.errors
            : (0, utils_1.formatI18nErrors)(exception.errors ?? [], (0, utils_1.getI18nContextOrThrow)(i18n_context_1.I18nContext.current(host) ?? i18n_context_1.I18nContext.current()).service, {
                lang: (i18n_context_1.I18nContext.current(host) ?? i18n_context_1.I18nContext.current())?.lang,
            });
        const normalizedErrors = this.normalizeValidationErrors(errors);
        switch (host.getType()) {
            case i18n_constants_1.ExecutionContextType.HTTP:
                const response = host.switchToHttp().getResponse();
                const responseBody = this.buildResponseBody(host, exception, normalizedErrors);
                response
                    .status(this.options.errorHttpStatusCode || exception.getStatus())
                    .send(responseBody);
                break;
            case i18n_constants_1.ExecutionContextType.GRAPHQL:
                return this.createGraphQLError(exception, normalizedErrors);
        }
    }
    async createGraphQLError(exception, errors) {
        const status = this.options.errorHttpStatusCode || exception.getStatus();
        try {
            const { GraphQLError } = await Promise.resolve().then(() => __importStar(require('graphql')));
            return new GraphQLError(exception.message, {
                extensions: {
                    code: 'BAD_USER_INPUT',
                    status,
                    errors,
                },
            });
        }
        catch {
            exception.errors = errors;
            return exception;
        }
    }
    isWithErrorFormatter(options) {
        return 'errorFormatter' in options;
    }
    normalizeValidationErrors(validationErrors) {
        if (this.isWithErrorFormatter(this.options) &&
            !('detailedErrors' in this.options) &&
            this.options.errorFormatter)
            return this.options.errorFormatter(validationErrors);
        if (!this.isWithErrorFormatter(this.options) &&
            !this.options.detailedErrors)
            return this.flattenValidationErrors(validationErrors);
        return validationErrors;
    }
    flattenValidationErrors(validationErrors) {
        return validationErrors
            .map((error) => (0, utils_1.mapChildrenToValidationErrors)(error))
            .flat()
            .filter((item) => !!item.constraints)
            .map((item) => Object.values(item.constraints ?? {}))
            .flat();
    }
    buildResponseBody(host, exc, error) {
        if ('responseBodyFormatter' in this.options &&
            this.options.responseBodyFormatter) {
            return this.options.responseBodyFormatter(host, exc, error);
        }
        return {
            statusCode: this.options.errorHttpStatusCode === undefined
                ? exc.getStatus()
                : this.options.errorHttpStatusCode,
            message: error,
            error: exc.getResponse(),
        };
    }
};
exports.I18nValidationExceptionFilter = I18nValidationExceptionFilter;
exports.I18nValidationExceptionFilter = I18nValidationExceptionFilter = __decorate([
    (0, common_1.Catch)(interfaces_1.I18nValidationException),
    __metadata("design:paramtypes", [Object])
], I18nValidationExceptionFilter);
//# sourceMappingURL=i18n-validation-exception.filter.js.map