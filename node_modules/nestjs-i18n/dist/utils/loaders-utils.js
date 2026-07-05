"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.processTranslations = processTranslations;
exports.processLanguages = processLanguages;
const rxjs_1 = require("rxjs");
const operators_1 = require("rxjs/operators");
const merge_1 = require("./merge");
const hasSameReferences = (left, right) => {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((value, index) => value === right[index]);
};
const hasSameLanguageValues = (left, right) => {
    if (left.length !== right.length) {
        return false;
    }
    return left.every((value, index) => value === right[index]);
};
const cloneTranslation = (translation) => (0, merge_1.mergeDeep)({}, translation);
const mergeTranslationResults = (results, cache) => {
    if (cache.previousMerged && hasSameReferences(cache.previousResults, results)) {
        return cache.previousMerged;
    }
    let firstChangedIndex = 0;
    while (firstChangedIndex < cache.previousResults.length &&
        cache.previousResults[firstChangedIndex] === results[firstChangedIndex]) {
        firstChangedIndex++;
    }
    const prefixMerges = cache.prefixMerges.slice(0, firstChangedIndex + 1);
    let merged = firstChangedIndex === 0
        ? {}
        : cache.prefixMerges[firstChangedIndex];
    for (let index = firstChangedIndex; index < results.length; index++) {
        merged = (0, merge_1.mergeDeep)(cloneTranslation(merged), results[index]);
        prefixMerges[index + 1] = merged;
    }
    cache.previousResults = [...results];
    cache.prefixMerges = prefixMerges;
    cache.previousMerged = merged;
    return merged;
};
async function processTranslations(loaders) {
    const rawResults = await Promise.all(loaders.map((l) => l.load()));
    const hasObservable = rawResults.some((r) => r instanceof rxjs_1.Observable);
    if (!hasObservable) {
        return rawResults.reduce((acc, curr) => (0, merge_1.mergeDeep)(acc, curr), {});
    }
    const observables = rawResults.map((result) => result instanceof rxjs_1.Observable
        ? result
        : (0, rxjs_1.of)(result));
    const cache = {
        previousMerged: null,
        previousResults: [],
        prefixMerges: [{}],
    };
    return (0, rxjs_1.combineLatest)(observables).pipe((0, operators_1.map)((results) => mergeTranslationResults(results, cache)), (0, operators_1.distinctUntilChanged)((left, right) => left === right), (0, rxjs_1.shareReplay)({ bufferSize: 1, refCount: true }));
}
async function processLanguages(loaders) {
    const rawResults = await Promise.all(loaders.map((l) => l.languages()));
    const hasObservable = rawResults.some((r) => r instanceof rxjs_1.Observable);
    if (!hasObservable) {
        const allLangs = rawResults.flat();
        return [...new Set(allLangs)];
    }
    const observables = rawResults.map((result) => result instanceof rxjs_1.Observable
        ? result
        : (0, rxjs_1.of)(result));
    return (0, rxjs_1.combineLatest)(observables).pipe((0, operators_1.map)((results) => [...new Set(results.flat())]), (0, operators_1.distinctUntilChanged)((left, right) => hasSameLanguageValues(left, right)), (0, rxjs_1.shareReplay)({ bufferSize: 1, refCount: true }));
}
//# sourceMappingURL=loaders-utils.js.map