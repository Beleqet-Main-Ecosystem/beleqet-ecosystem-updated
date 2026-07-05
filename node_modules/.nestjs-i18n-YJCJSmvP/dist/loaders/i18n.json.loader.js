"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nJsonLoader = void 0;
const i18n_error_1 = require("../i18n.error");
const i18n_abstract_loader_1 = require("./i18n.abstract.loader");
class I18nJsonLoader extends i18n_abstract_loader_1.I18nAbstractLoader {
    getDefaultOptions() {
        return {
            filePattern: '*.json',
            watch: false,
        };
    }
    formatData(data) {
        try {
            return JSON.parse(data);
        }
        catch (e) {
            if (e instanceof SyntaxError) {
                throw new i18n_error_1.I18nError('Invalid JSON file. Please check your JSON syntax.');
            }
            throw e;
        }
    }
}
exports.I18nJsonLoader = I18nJsonLoader;
//# sourceMappingURL=i18n.json.loader.js.map