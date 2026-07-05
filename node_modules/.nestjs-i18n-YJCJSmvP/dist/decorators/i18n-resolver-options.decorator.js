"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getI18nResolverOptionsToken = getI18nResolverOptionsToken;
exports.I18nResolverOptions = I18nResolverOptions;
const common_1 = require("@nestjs/common");
const i18n_constants_1 = require("../i18n.constants");
function getI18nResolverOptionsToken(target) {
    return `${target.name}${i18n_constants_1.I18N_RESOLVER_OPTIONS}`;
}
function I18nResolverOptions() {
    return (target, key, index) => {
        return (0, common_1.Inject)(getI18nResolverOptionsToken(target))(target, key, index);
    };
}
//# sourceMappingURL=i18n-resolver-options.decorator.js.map