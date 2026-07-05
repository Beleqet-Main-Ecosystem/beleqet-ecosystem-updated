"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getI18nContextOrThrow = getI18nContextOrThrow;
const utils_1 = require("../utils");
const i18n_error_1 = require("../i18n.error");
function getI18nContextOrThrow(i18n) {
    if (i18n === undefined) {
        utils_1.logger.error('I18n context not found! Is this function triggered by a processor or cronjob? Please use the I18nService');
        throw new i18n_error_1.I18nError('I18n context undefined');
    }
    return i18n;
}
//# sourceMappingURL=i18n-context.js.map