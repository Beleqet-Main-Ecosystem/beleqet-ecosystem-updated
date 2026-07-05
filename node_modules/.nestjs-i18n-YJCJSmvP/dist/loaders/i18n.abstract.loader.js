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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var I18nAbstractLoader_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nAbstractLoader = void 0;
const i18n_loader_1 = require("./i18n.loader");
const i18n_constants_1 = require("../i18n.constants");
const common_1 = require("@nestjs/common");
const path_1 = __importDefault(require("path"));
const promises_1 = require("fs/promises");
const utils_1 = require("../utils");
const rxjs_1 = require("rxjs");
const chokidar_1 = __importDefault(require("chokidar"));
const i18n_error_1 = require("../i18n.error");
let I18nAbstractLoader = I18nAbstractLoader_1 = class I18nAbstractLoader extends i18n_loader_1.I18nLoader {
    constructor(options) {
        super();
        this.options = options;
        this.logger = new common_1.Logger(I18nAbstractLoader_1.name);
        this.events = new rxjs_1.Subject();
        this.languagesCache = null;
        this.options = this.sanitizeOptions(options);
        if (this.options.watch) {
            this.watcher = chokidar_1.default
                .watch(this.options.path, { ignoreInitial: true })
                .on('all', (event, filePath) => {
                this.events.next({
                    event,
                    filePath,
                });
            });
        }
    }
    async onModuleDestroy() {
        if (this.watcher) {
            await this.watcher.close();
        }
    }
    async languages() {
        if (this.options.watch) {
            return (0, rxjs_1.merge)((0, rxjs_1.of)(await this.parseLanguages()), this.events.pipe((0, rxjs_1.switchMap)(() => (0, rxjs_1.from)(this.parseLanguages()).pipe((0, rxjs_1.catchError)((error) => {
                this.logger.error('Error while parsing i18n languages. Ignoring this change.', error);
                return rxjs_1.EMPTY;
            })))));
        }
        return this.parseLanguages();
    }
    async load() {
        if (this.options.watch) {
            return (0, rxjs_1.merge)((0, rxjs_1.of)(await this.parseTranslations()), this.events.pipe((0, rxjs_1.switchMap)((eventInfo) => (0, rxjs_1.from)(this.parseTranslations(eventInfo)).pipe((0, rxjs_1.catchError)((error) => {
                this.logger.error('Error while parsing i18n translations. Ignoring this change.', error);
                return rxjs_1.EMPTY;
            })))));
        }
        return this.parseTranslations();
    }
    async parseTranslations(eventInfo) {
        const i18nPath = path_1.default.normalize(this.options.path + path_1.default.sep);
        const translations = {};
        if (!(await (0, utils_1.exists)(i18nPath))) {
            throw new i18n_error_1.I18nError(`i18n path (${i18nPath}) cannot be found`);
        }
        const shouldRefreshLanguages = !eventInfo || eventInfo.event === 'addDir' || eventInfo.event === 'unlinkDir';
        const languages = shouldRefreshLanguages
            ? await this.parseLanguages()
            : await this.getCachedLanguages();
        const pattern = this.parseFilePattern(this.options.filePattern);
        const files = await [
            ...languages.map((l) => path_1.default.join(i18nPath, l)),
            i18nPath,
        ].reduce(async (f, p) => {
            (await f).push(...(await (0, utils_1.getFiles)(p, pattern, this.options.includeSubfolders ?? false)));
            return f;
        }, Promise.resolve([]));
        for (const file of files) {
            let global = false;
            const pathParts = path_1.default
                .dirname(path_1.default.relative(i18nPath, file))
                .split(path_1.default.sep);
            const key = pathParts[0];
            if (key === '.') {
                global = true;
            }
            let data;
            try {
                data = this.formatData(await (0, promises_1.readFile)(file, 'utf8'));
            }
            catch (e) {
                const error = e;
                throw new i18n_error_1.I18nError(`Error parsing translation file "${file}": ${error.message}`);
            }
            const prefix = [...pathParts.slice(1), path_1.default.basename(file).split('.')[0]];
            for (const property of Object.keys(data)) {
                [...(global ? languages : [key])].forEach((lang) => {
                    if (!translations[lang] || typeof translations[lang] === 'string') {
                        translations[lang] = {};
                    }
                    const langTranslations = translations[lang];
                    if (global) {
                        langTranslations[property] = data[property];
                    }
                    else {
                        this.assignPrefixedTranslation(langTranslations, prefix, property, data[property]);
                    }
                });
            }
        }
        return translations;
    }
    assignPrefixedTranslation(translations, prefix, property, value) {
        if (prefix.length) {
            const [currentPrefix, ...nextPrefixes] = prefix;
            const currentValue = translations[currentPrefix];
            if (!currentValue || typeof currentValue === 'string') {
                translations[currentPrefix] = {};
            }
            this.assignPrefixedTranslation(translations[currentPrefix], nextPrefixes, property, value);
        }
        else {
            translations[property] = value;
        }
    }
    async parseLanguages() {
        const i18nPath = path_1.default.normalize(this.options.path + path_1.default.sep);
        this.languagesCache = (await (0, utils_1.getDirectories)(i18nPath)).map((dir) => path_1.default.relative(i18nPath, dir));
        return this.languagesCache;
    }
    async getCachedLanguages() {
        if (this.languagesCache) {
            return this.languagesCache;
        }
        return this.parseLanguages();
    }
    sanitizeOptions(options) {
        options = { ...this.getDefaultOptions(), ...options };
        options.path = path_1.default.normalize(options.path + path_1.default.sep);
        options.filePattern = options.filePattern ?? '*.json';
        if (!options.filePattern.startsWith('*.')) {
            options.filePattern = '*.' + options.filePattern;
        }
        return options;
    }
    parseFilePattern(filePattern) {
        const singleExtensionPattern = /^\*\.([A-Za-z0-9_-]+)$/;
        const groupedExtensionPattern = /^\*\.\{([^}]+)\}$/;
        const singleExtensionMatch = filePattern.match(singleExtensionPattern);
        if (singleExtensionMatch) {
            return new RegExp(`^.*\\.${singleExtensionMatch[1]}$`);
        }
        const groupedExtensionMatch = filePattern.match(groupedExtensionPattern);
        if (!groupedExtensionMatch) {
            throw new i18n_error_1.I18nError(`filePattern should be formatted like: *.json, *.txt or *.{yaml,yml}`);
        }
        const extensions = groupedExtensionMatch[1]
            .split(/[,|]/)
            .map((extension) => extension.trim())
            .filter((extension) => extension.length > 0);
        if (extensions.length === 0 ||
            extensions.some((extension) => !extension.match(/^[A-Za-z0-9_-]+$/))) {
            throw new i18n_error_1.I18nError(`filePattern should be formatted like: *.json, *.txt or *.{yaml,yml}`);
        }
        return new RegExp(`^.*\\.(${extensions.join('|')})$`);
    }
};
exports.I18nAbstractLoader = I18nAbstractLoader;
exports.I18nAbstractLoader = I18nAbstractLoader = I18nAbstractLoader_1 = __decorate([
    __param(0, (0, common_1.Inject)(i18n_constants_1.I18N_LOADER_OPTIONS)),
    __metadata("design:paramtypes", [Object])
], I18nAbstractLoader);
//# sourceMappingURL=i18n.abstract.loader.js.map