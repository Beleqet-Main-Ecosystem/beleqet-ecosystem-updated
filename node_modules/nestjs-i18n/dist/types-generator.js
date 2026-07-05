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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateI18nTypes = generateI18nTypes;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const i18n_error_1 = require("./i18n.error");
const loaders_1 = require("./loaders");
const utils_1 = require("./utils");
async function generateI18nTypes(options) {
    const loader = options.format === 'yaml' ? new loaders_1.I18nYamlLoader(options) : new loaders_1.I18nJsonLoader(options);
    const loaded = await loader.load();
    const translations = loaded && typeof loaded.subscribe === 'function'
        ? await new Promise((resolve) => {
            loaded.subscribe((value) => {
                resolve(value);
            });
        })
        : loaded;
    const object = Object.keys(translations).reduce((result, key) => (0, utils_1.mergeDeep)(result, translations[key]), {});
    let rawContent;
    try {
        const ts = await Promise.resolve().then(() => __importStar(require('./utils/typescript')));
        rawContent = await ts.createTypesFile(object);
        if (!rawContent) {
            throw new i18n_error_1.I18nError('Failed to generate types file content');
        }
        const outputFile = ts.annotateSourceCode(rawContent);
        fs_1.default.mkdirSync(path_1.default.dirname(options.output), { recursive: true });
        let currentFileContent = null;
        try {
            currentFileContent = fs_1.default.readFileSync(options.output, 'utf8');
        }
        catch {
            currentFileContent = null;
        }
        if (currentFileContent === outputFile) {
            return {
                output: options.output,
                written: false,
            };
        }
        fs_1.default.writeFileSync(options.output, outputFile);
        return {
            output: options.output,
            written: true,
        };
    }
    finally {
        if (typeof loader.onModuleDestroy === 'function') {
            await loader.onModuleDestroy();
        }
    }
}
//# sourceMappingURL=types-generator.js.map