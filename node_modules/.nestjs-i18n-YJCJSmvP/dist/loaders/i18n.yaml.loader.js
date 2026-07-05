"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.I18nYamlLoader = void 0;
const i18n_error_1 = require("../i18n.error");
const i18n_abstract_loader_1 = require("./i18n.abstract.loader");
const yaml_1 = __importDefault(require("yaml"));
class I18nYamlLoader extends i18n_abstract_loader_1.I18nAbstractLoader {
    getDefaultOptions() {
        return {
            filePattern: '*.{yaml,yml}',
            watch: false,
        };
    }
    formatData(data) {
        try {
            return yaml_1.default.parse(data);
        }
        catch (e) {
            if (e && e.name === 'YAMLParseError') {
                throw new i18n_error_1.I18nError('Invalid YAML file. Please check your YAML syntax.');
            }
            throw e;
        }
    }
}
exports.I18nYamlLoader = I18nYamlLoader;
//# sourceMappingURL=i18n.yaml.loader.js.map