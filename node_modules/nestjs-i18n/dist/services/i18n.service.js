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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nService = void 0;
const common_1 = require("@nestjs/common");
const rxjs_1 = require("rxjs");
const i18n_constants_1 = require("../i18n.constants");
const i18n_context_1 = require("../i18n.context");
const i18n_error_1 = require("../i18n.error");
const utils_1 = require("../utils");
const translationTransformPipes = {
    [i18n_constants_1.TransformPipeName.UPPERCASE]: (value) => value.toUpperCase(),
    [i18n_constants_1.TransformPipeName.LOWERCASE]: (value) => value.toLowerCase(),
    [i18n_constants_1.TransformPipeName.CAPITALIZE]: (value) => value.length > 0
        ? value.charAt(0).toUpperCase() + value.slice(1).toLowerCase()
        : value,
};
let I18nService = class I18nService {
    constructor(i18nOptions, translations, supportedLanguages, logger, loaders, languagesSubject, translationsSubject) {
        this.i18nOptions = i18nOptions;
        this.logger = logger;
        this.loaders = loaders;
        this.languagesSubject = languagesSubject;
        this.translationsSubject = translationsSubject;
        this.pluralRules = new Map();
        this.transformPlaceholderCounter = 0;
        this.unsubscribe = new rxjs_1.Subject();
        this.hbsHelper = (key, args, options) => {
            if (!options) {
                options = args;
            }
            const lang = options.lookupProperty(options.data.root, 'i18nLang');
            return this.t(key, { lang, args });
        };
        supportedLanguages
            .pipe((0, rxjs_1.takeUntil)(this.unsubscribe))
            .subscribe((languages) => {
            this.supportedLanguages = languages;
        });
        translations.pipe((0, rxjs_1.takeUntil)(this.unsubscribe)).subscribe((t) => {
            this.translations = t;
        });
    }
    onModuleDestroy() {
        this.unsubscribe.next();
        this.unsubscribe.complete();
    }
    translate(key, options) {
        options = {
            lang: i18n_context_1.I18nContext.current()?.lang || this.i18nOptions.fallbackLanguage,
            ...options,
        };
        const { defaultValue } = options;
        let { lang } = options;
        if (lang === 'debug') {
            return key;
        }
        const previousFallbackLang = lang;
        lang = lang ?? this.i18nOptions.fallbackLanguage;
        lang = this.resolveLanguage(lang);
        const translationsByLanguage = this.translations[lang];
        const translation = this.translateObject(key, (translationsByLanguage ?? key), lang, options, translationsByLanguage);
        if (translationsByLanguage == null || !translation) {
            const translationKeyMissing = `Translation "${key}" in "${lang}" does not exist.`;
            if (lang !== this.i18nOptions.fallbackLanguage || defaultValue) {
                if (this.i18nOptions.throwOnMissingKey) {
                    if (this.i18nOptions.logging) {
                        this.logger.error(translationKeyMissing);
                    }
                    throw new i18n_error_1.I18nError(translationKeyMissing);
                }
                const nextFallbackLanguage = this.getFallbackLanguage(lang);
                if (previousFallbackLang !== nextFallbackLanguage) {
                    return this.translate(key, {
                        ...options,
                        lang: nextFallbackLanguage,
                    });
                }
            }
        }
        return (translation ?? key);
    }
    getFallbackLanguage(lang) {
        let regionSepIndex = -1;
        if (lang.includes('-')) {
            regionSepIndex = lang.lastIndexOf('-');
        }
        if (lang.includes('_')) {
            regionSepIndex = lang.lastIndexOf('_');
        }
        return regionSepIndex !== -1
            ? lang.slice(0, regionSepIndex)
            : this.i18nOptions.fallbackLanguage;
    }
    t(key, options) {
        return this.translate(key, options);
    }
    getSupportedLanguages() {
        return this.supportedLanguages;
    }
    getTranslations() {
        return this.translations;
    }
    async refresh(translations, languages) {
        if (!translations) {
            translations = await (0, utils_1.processTranslations)(this.loaders);
        }
        if (translations instanceof rxjs_1.Observable) {
            this.translationsSubject.next(await (0, rxjs_1.lastValueFrom)(translations.pipe((0, rxjs_1.take)(1))));
        }
        else {
            this.translationsSubject.next(translations);
        }
        if (!languages) {
            languages = await (0, utils_1.processLanguages)(this.loaders);
        }
        if (languages instanceof rxjs_1.Observable) {
            this.languagesSubject.next(await (0, rxjs_1.lastValueFrom)(languages.pipe((0, rxjs_1.take)(1))));
        }
        else {
            this.languagesSubject.next(languages);
        }
    }
    translateObject(key, translations, lang, options, rootTranslations) {
        const args = options?.args;
        const translationObject = typeof translations === 'string' ? undefined : translations;
        let translation = (translationObject
            ? this.getTranslationByKey(translationObject, key, options)
            : translations) ??
            options?.defaultValue;
        if (translation && args !== undefined) {
            const pluralObject = this.getPluralObject(translation);
            const countValue = !Array.isArray(args) && args ? args['count'] : undefined;
            if (pluralObject && countValue !== undefined) {
                const count = Number(countValue);
                let pluralRules = this.pluralRules.get(lang);
                if (!pluralRules) {
                    pluralRules = new Intl.PluralRules(lang);
                    this.pluralRules.set(lang, pluralRules);
                }
                const pluralCategory = pluralRules.select(count);
                if (count === 0 && pluralObject['zero']) {
                    translation = pluralObject['zero'];
                }
                else if (pluralObject[pluralCategory]) {
                    translation = pluralObject[pluralCategory];
                }
            }
        }
        if (translation instanceof Object) {
            const shouldReturnObjects = options?.returnObjects ?? this.i18nOptions.returnObjects ?? true;
            const joinArrays = options?.joinArrays ?? this.i18nOptions.joinArrays;
            if (translation instanceof Array) {
                if (typeof joinArrays === 'string') {
                    return translation.map((item) => String(item)).join(joinArrays);
                }
                if (!shouldReturnObjects) {
                    return key;
                }
                if (args === undefined) {
                    return translation;
                }
                const result = {};
                for (const nestedKey of Object.keys(translation)) {
                    const nestedTranslation = this.translateObject(nestedKey, translation, lang, options, rootTranslations);
                    result[nestedKey] =
                        nestedTranslation === undefined ? nestedKey : nestedTranslation;
                }
                return Object.values(result);
            }
            if (!shouldReturnObjects) {
                return key;
            }
            if (args === undefined) {
                return translation;
            }
            const result = {};
            for (const nestedKey of Object.keys(translation)) {
                const nestedTranslation = this.translateObject(nestedKey, translation, lang, options, rootTranslations);
                result[nestedKey] =
                    nestedTranslation === undefined ? nestedKey : nestedTranslation;
            }
            return result;
        }
        if (typeof translation !== 'string') {
            return translation;
        }
        if (args !== undefined) {
            const { template, formatterArgs } = this.applyTranslationTransformPipes(translation, args);
            if (this.i18nOptions.formatter) {
                translation = this.i18nOptions.formatter(template, ...formatterArgs);
            }
            else {
                translation = template;
            }
            const nestedTranslations = this.getNestedTranslations(translation);
            if (nestedTranslations && nestedTranslations.length > 0) {
                let offset = 0;
                for (const nestedTranslation of nestedTranslations) {
                    const result = rootTranslations
                        ? (this.translateObject(nestedTranslation.key, rootTranslations, lang, {
                            ...options,
                            args: { parent: options?.args, ...nestedTranslation.args },
                        }) ?? '')
                        : '';
                    translation =
                        translation.substring(0, nestedTranslation.index - offset) +
                            result +
                            translation.substring(nestedTranslation.index + nestedTranslation.length - offset);
                    offset = offset + (nestedTranslation.length - result.length);
                }
            }
        }
        return translation;
    }
    getTranslationByKey(translations, key, options) {
        if (translations[key] !== undefined) {
            return translations[key];
        }
        const nsSeparator = this.getNamespaceSeparator(options);
        if (nsSeparator && key.includes(nsSeparator)) {
            const separatorIndex = key.indexOf(nsSeparator);
            const namespace = key.slice(0, separatorIndex);
            const namespacedKey = key.slice(separatorIndex + nsSeparator.length);
            const namespaceTranslations = translations[namespace];
            if (namespaceTranslations !== undefined &&
                typeof namespaceTranslations !== 'string') {
                return this.getTranslationByKey(namespaceTranslations, namespacedKey, {
                    ...options,
                    nsSeparator: false,
                });
            }
        }
        const keySeparator = this.getKeySeparator(options);
        if (!keySeparator || !key.includes(keySeparator)) {
            return undefined;
        }
        const separatorIndex = key.indexOf(keySeparator);
        const firstKey = key.slice(0, separatorIndex);
        const nestedKey = key.slice(separatorIndex + keySeparator.length);
        const nestedTranslations = translations[firstKey];
        if (nestedTranslations && typeof nestedTranslations !== 'string') {
            return this.getTranslationByKey(nestedTranslations, nestedKey, options);
        }
        return undefined;
    }
    getKeySeparator(options) {
        return options?.keySeparator ?? this.i18nOptions.keySeparator ?? i18n_constants_1.DEFAULT_KEY_SEPARATOR;
    }
    getNamespaceSeparator(options) {
        return options?.nsSeparator ?? this.i18nOptions.nsSeparator ?? i18n_constants_1.DEFAULT_NAMESPACE_SEPARATOR;
    }
    applyTranslationTransformPipes(template, args) {
        const transformedValues = {};
        const withPipesApplied = template.replace(/\{\{\s*([^{}]+?)\s*\}\}/g, (match, rawExpression) => {
            const parts = rawExpression
                .split(i18n_constants_1.PIPE_SEPARATOR)
                .map((part) => part.trim())
                .filter((part) => part.length > 0);
            if (parts.length < 2) {
                return match;
            }
            const [argPath, ...transforms] = parts;
            const rawValue = this.getArgValueByPath(args, argPath);
            let transformedValue = rawValue == null ? '' : String(rawValue);
            for (const transformName of transforms) {
                const transformFn = translationTransformPipes[transformName.toLowerCase()];
                if (!transformFn) {
                    continue;
                }
                transformedValue = transformFn(transformedValue);
            }
            const placeholderKey = `__i18n_transform_${this
                .transformPlaceholderCounter++}`;
            transformedValues[placeholderKey] = transformedValue;
            return `{${placeholderKey}}`;
        });
        const formatterArgs = this.createFormatterArgs(args, transformedValues);
        return {
            template: withPipesApplied,
            formatterArgs,
        };
    }
    createFormatterArgs(args, transformedValues = {}) {
        if (!args || !Object.keys(transformedValues).length) {
            return args instanceof Array ? args || [] : [args];
        }
        if (!(args instanceof Array)) {
            return [{ ...args, ...transformedValues }];
        }
        const formatterArgs = [...args];
        const objectArgIndex = formatterArgs.findIndex((entry) => typeof entry === 'object' && entry !== null);
        if (objectArgIndex === -1) {
            formatterArgs.push(transformedValues);
            return formatterArgs;
        }
        formatterArgs[objectArgIndex] = {
            ...formatterArgs[objectArgIndex],
            ...transformedValues,
        };
        return formatterArgs;
    }
    getArgValueByPath(args, path) {
        if (!args || !path) {
            return undefined;
        }
        const sources = args instanceof Array ? args : [args];
        for (const source of sources) {
            if (typeof source !== 'object' || source === null) {
                continue;
            }
            const value = path
                .split('.')
                .reduce((acc, key) => {
                if (acc == null || typeof acc !== 'object') {
                    return undefined;
                }
                return acc[key];
            }, source);
            if (value !== undefined) {
                return value;
            }
        }
        return undefined;
    }
    resolveLanguage(lang) {
        if (this.i18nOptions.fallbacks && !this.supportedLanguages.includes(lang)) {
            const sanitizedLang = lang.includes('-')
                ? lang.substring(0, lang.indexOf('-')).concat('-*')
                : lang;
            for (const key in this.i18nOptions.fallbacks) {
                if (key === lang || key === sanitizedLang) {
                    lang = this.i18nOptions.fallbacks[key];
                    break;
                }
            }
        }
        return lang;
    }
    getPluralObject(translation) {
        for (const k of i18n_constants_1.PLURAL_KEYS) {
            if (translation[k]) {
                return translation;
            }
        }
        return undefined;
    }
    getNestedTranslations(translation) {
        const list = [];
        const regex = /\$t\((.*?)(,(.*?))?\)/g;
        let result;
        while ((result = regex.exec(translation)) !== null) {
            const key = result[1]?.trim();
            if (!key) {
                continue;
            }
            let args = {};
            if (result.length >= 3 && result[3]) {
                try {
                    args = JSON.parse(result[3]);
                }
                catch (e) {
                    this.logger.error(`Error while parsing JSON`, e);
                }
            }
            list.push({
                index: result.index,
                length: result[0].length,
                key,
                args,
            });
        }
        return list.length > 0 ? list : undefined;
    }
    async validate(value, options) {
        const validate = await this.getClassValidatorValidate();
        const errors = await validate(value, this.i18nOptions.validatorOptions);
        return (0, utils_1.formatI18nErrors)(errors, this, options);
    }
    async getClassValidatorValidate() {
        try {
            const module = await Promise.resolve().then(() => __importStar(require('class-validator')));
            if (typeof module.validate !== 'function') {
                throw new Error('Missing validate export');
            }
            return module.validate;
        }
        catch {
            throw new i18n_error_1.I18nError('class-validator is required when using i18n validation features. Install it with: npm install class-validator');
        }
    }
};
exports.I18nService = I18nService;
exports.I18nService = I18nService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, common_1.Inject)(i18n_constants_1.I18N_OPTIONS)),
    __param(1, (0, common_1.Inject)(i18n_constants_1.I18N_TRANSLATIONS)),
    __param(2, (0, common_1.Inject)(i18n_constants_1.I18N_LANGUAGES)),
    __param(4, (0, common_1.Inject)(i18n_constants_1.I18N_LOADERS)),
    __param(5, (0, common_1.Inject)(i18n_constants_1.I18N_LANGUAGES_SUBJECT)),
    __param(6, (0, common_1.Inject)(i18n_constants_1.I18N_TRANSLATIONS_SUBJECT)),
    __metadata("design:paramtypes", [Object, rxjs_1.Observable,
        rxjs_1.Observable,
        common_1.Logger, Array, rxjs_1.BehaviorSubject,
        rxjs_1.BehaviorSubject])
], I18nService);
//# sourceMappingURL=i18n.service.js.map