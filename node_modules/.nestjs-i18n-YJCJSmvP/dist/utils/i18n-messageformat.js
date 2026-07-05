"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nMessageFormat = void 0;
const core_1 = __importDefault(require("@messageformat/core"));
class I18nMessageFormat {
    constructor(i18nOptions) {
        this.i18nOptions = i18nOptions;
        this.messageFormats = new Map();
    }
    get enabled() {
        return Boolean(this.i18nOptions.useICU);
    }
    compile(message, locale) {
        try {
            let messageFormat = this.messageFormats.get(locale);
            if (!messageFormat) {
                messageFormat = new core_1.default(this.i18nOptions.icuLocales ?? locale, {
                    biDiSupport: this.i18nOptions.icuOptions?.biDiSupport,
                    customFormatters: this.i18nOptions.icuOptions?.formatters,
                });
                this.messageFormats.set(locale, messageFormat);
            }
            return messageFormat.compile(message);
        }
        catch {
            return (() => message);
        }
    }
}
exports.I18nMessageFormat = I18nMessageFormat;
//# sourceMappingURL=i18n-messageformat.js.map