"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkI18nTranslations = checkI18nTranslations;
const loaders_1 = require("../loaders");
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function collectKeys(value, parentKey = '') {
    if (!isPlainObject(value)) {
        return parentKey ? [parentKey] : [];
    }
    const keys = [];
    for (const [key, nestedValue] of Object.entries(value)) {
        const nextKey = parentKey ? `${parentKey}.${key}` : key;
        if (isPlainObject(nestedValue)) {
            keys.push(...collectKeys(nestedValue, nextKey));
            continue;
        }
        keys.push(nextKey);
    }
    return keys;
}
function getLoader(options) {
    if (options.format === 'yaml') {
        return new loaders_1.I18nYamlLoader(options);
    }
    return new loaders_1.I18nJsonLoader(options);
}
async function checkI18nTranslations(options) {
    const loader = getLoader(options);
    try {
        const rawLanguages = await loader.languages();
        const rawTranslations = await loader.load();
        const languages = rawLanguages;
        const translations = rawTranslations;
        const allKeys = new Set();
        const keysByLanguage = {};
        for (const language of languages) {
            const languageKeys = new Set(collectKeys(translations[language] ?? {}));
            keysByLanguage[language] = languageKeys;
            for (const key of languageKeys) {
                allKeys.add(key);
            }
        }
        const missingByLanguage = {};
        let totalMissing = 0;
        for (const language of languages) {
            const missingKeys = Array.from(allKeys)
                .filter((key) => !keysByLanguage[language].has(key))
                .sort();
            missingByLanguage[language] = missingKeys;
            totalMissing += missingKeys.length;
        }
        return {
            ok: totalMissing === 0,
            languages,
            missingByLanguage,
            totalMissing,
        };
    }
    finally {
        await loader.onModuleDestroy();
    }
}
//# sourceMappingURL=check-translations.js.map