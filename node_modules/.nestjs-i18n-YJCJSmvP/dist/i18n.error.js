"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nError = void 0;
class I18nError extends Error {
    constructor(message) {
        super(message);
        this.name = 'I18nError';
    }
}
exports.I18nError = I18nError;
//# sourceMappingURL=i18n.error.js.map