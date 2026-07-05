"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18n = void 0;
const common_1 = require("@nestjs/common");
const i18n_context_1 = require("../i18n.context");
const utils_1 = require("../utils");
exports.I18n = (0, common_1.createParamDecorator)((_, context) => {
    return (0, utils_1.getI18nContextOrThrow)(i18n_context_1.I18nContext.current(context));
});
//# sourceMappingURL=i18n.decorator.js.map