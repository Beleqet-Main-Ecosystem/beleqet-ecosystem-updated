"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nContext = void 0;
const async_hooks_1 = require("async_hooks");
const utils_1 = require("./utils");
class I18nContext {
    get i18n() {
        return this;
    }
    constructor(lang, service, messageFormat) {
        this.lang = lang;
        this.service = service;
        this.messageFormat = messageFormat;
        this.id = I18nContext.counter++;
    }
    translate(key, options) {
        const translatedOptions = {
            lang: this.lang,
            ...options,
        };
        const useICU = translatedOptions.useICU ?? this.messageFormat.enabled;
        const rawResult = useICU
            ? this.service.translate(key, { ...translatedOptions, args: undefined })
            : this.service.translate(key, translatedOptions);
        if (!useICU || typeof rawResult !== 'string') {
            return rawResult;
        }
        const icuArgs = translatedOptions.args && !Array.isArray(translatedOptions.args)
            ? translatedOptions.args
            : undefined;
        try {
            const compiled = this.messageFormat.compile(rawResult, translatedOptions.lang);
            return compiled(icuArgs ?? {});
        }
        catch {
            return rawResult;
        }
    }
    t(key, options) {
        return this.translate(key, options);
    }
    validate(value, options) {
        options = {
            lang: this.lang,
            ...options,
        };
        return this.service.validate(value, options);
    }
    static create(ctx, next) {
        this.storage.run(ctx, next);
    }
    static async createAsync(ctx, next) {
        return this.storage.run(ctx, next);
    }
    static current(context) {
        const i18n = this.storage.getStore();
        if (!i18n && context) {
            return (0, utils_1.getContextObject)(undefined, context)?.i18nContext;
        }
        return i18n;
    }
}
exports.I18nContext = I18nContext;
I18nContext.storage = new async_hooks_1.AsyncLocalStorage();
I18nContext.counter = 1;
//# sourceMappingURL=i18n.context.js.map