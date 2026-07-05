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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateI18nTypes = exports.getContextObject = exports.i18nValidationMessage = exports.i18nValidationErrorFactory = exports.I18nMiddleware = exports.I18N_LOADER_OPTIONS = exports.I18N_RESOLVERS = exports.I18N_RESOLVER_OPTIONS = exports.I18N_LANGUAGES = exports.I18N_TRANSLATIONS = exports.I18N_OPTIONS = void 0;
__exportStar(require("./i18n.module"), exports);
var i18n_constants_1 = require("./i18n.constants");
Object.defineProperty(exports, "I18N_OPTIONS", { enumerable: true, get: function () { return i18n_constants_1.I18N_OPTIONS; } });
Object.defineProperty(exports, "I18N_TRANSLATIONS", { enumerable: true, get: function () { return i18n_constants_1.I18N_TRANSLATIONS; } });
Object.defineProperty(exports, "I18N_LANGUAGES", { enumerable: true, get: function () { return i18n_constants_1.I18N_LANGUAGES; } });
Object.defineProperty(exports, "I18N_RESOLVER_OPTIONS", { enumerable: true, get: function () { return i18n_constants_1.I18N_RESOLVER_OPTIONS; } });
Object.defineProperty(exports, "I18N_RESOLVERS", { enumerable: true, get: function () { return i18n_constants_1.I18N_RESOLVERS; } });
Object.defineProperty(exports, "I18N_LOADER_OPTIONS", { enumerable: true, get: function () { return i18n_constants_1.I18N_LOADER_OPTIONS; } });
__exportStar(require("./i18n.context"), exports);
__exportStar(require("./services/i18n.service"), exports);
__exportStar(require("./interfaces"), exports);
__exportStar(require("./decorators"), exports);
__exportStar(require("./resolvers"), exports);
__exportStar(require("./loaders"), exports);
__exportStar(require("./interceptors/i18n-language.interceptor"), exports);
__exportStar(require("./filters/i18n-validation-exception.filter"), exports);
var i18n_middleware_1 = require("./middlewares/i18n.middleware");
Object.defineProperty(exports, "I18nMiddleware", { enumerable: true, get: function () { return i18n_middleware_1.I18nMiddleware; } });
__exportStar(require("./pipes/i18n-validation.pipe"), exports);
var utils_1 = require("./utils");
Object.defineProperty(exports, "i18nValidationErrorFactory", { enumerable: true, get: function () { return utils_1.i18nValidationErrorFactory; } });
Object.defineProperty(exports, "i18nValidationMessage", { enumerable: true, get: function () { return utils_1.i18nValidationMessage; } });
Object.defineProperty(exports, "getContextObject", { enumerable: true, get: function () { return utils_1.getContextObject; } });
var types_generator_1 = require("./types-generator");
Object.defineProperty(exports, "generateI18nTypes", { enumerable: true, get: function () { return types_generator_1.generateI18nTypes; } });
//# sourceMappingURL=index.js.map