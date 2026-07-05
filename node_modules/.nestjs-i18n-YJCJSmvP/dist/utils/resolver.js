"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveLanguage = resolveLanguage;
exports.getLanguageFromResolverResult = getLanguageFromResolverResult;
exports.getResolver = getResolver;
const util_1 = require("./util");
async function resolveLanguage(resolvers, context, moduleRef) {
    for (const r of resolvers) {
        const resolver = await getResolver(r, moduleRef);
        let language = resolver.resolve(context);
        if (language instanceof Promise) {
            language = await language;
        }
        if (language !== undefined) {
            return language;
        }
    }
    return null;
}
function getLanguageFromResolverResult(language) {
    if (Array.isArray(language)) {
        return language[0];
    }
    return language ?? undefined;
}
async function getResolver(r, moduleRef) {
    if ((0, util_1.shouldResolve)(r)) {
        if ('use' in r) {
            return moduleRef.get(r.use);
        }
        return moduleRef.get(r);
    }
    return r;
}
//# sourceMappingURL=resolver.js.map