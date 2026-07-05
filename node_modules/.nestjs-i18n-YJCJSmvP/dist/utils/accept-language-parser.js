"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parse = parse;
exports.pick = pick;
function isString(s) {
    return typeof s === 'string';
}
function parse(al) {
    if (!al)
        return [];
    const parts = al.split(',');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
        const m = parts[i].trim();
        if (!m)
            continue;
        const bits = m.split(';');
        const ietf = bits[0].split('-');
        const hasScript = ietf.length === 3;
        result.push({
            code: ietf[0],
            script: hasScript ? ietf[1] : null,
            region: hasScript ? ietf[2] : ietf[1] || null,
            quality: bits[1] ? parseFloat(bits[1].split('=')[1]) : 1.0
        });
    }
    return result.sort((a, b) => b.quality - a.quality);
}
function pick(supportedLanguages, acceptLanguage, options = {}) {
    if (!supportedLanguages || !supportedLanguages.length || !acceptLanguage) {
        return null;
    }
    let parsedAcceptLanguage;
    if (isString(acceptLanguage)) {
        parsedAcceptLanguage = parse(acceptLanguage);
    }
    else {
        parsedAcceptLanguage = acceptLanguage;
    }
    const supported = supportedLanguages.map((support) => {
        const bits = support.split('-');
        const hasScript = bits.length === 3;
        return {
            code: bits[0],
            script: hasScript ? bits[1] : null,
            region: hasScript ? bits[2] : bits[1] || null
        };
    });
    for (let i = 0; i < parsedAcceptLanguage.length; i++) {
        const lang = parsedAcceptLanguage[i];
        const langCode = lang.code.toLowerCase();
        const langRegion = lang.region ? lang.region.toLowerCase() : null;
        const langScript = lang.script ? lang.script.toLowerCase() : null;
        for (let j = 0; j < supported.length; j++) {
            const supportedCode = supported[j].code.toLowerCase();
            const supportedScript = supported[j].script?.toLowerCase() ?? null;
            const supportedRegion = supported[j].region?.toLowerCase() ?? null;
            if (langCode === supportedCode &&
                (options.loose || !langScript || langScript === supportedScript) &&
                (options.loose || !langRegion || langRegion === supportedRegion)) {
                return supportedLanguages[j];
            }
        }
    }
    return null;
}
//# sourceMappingURL=accept-language-parser.js.map