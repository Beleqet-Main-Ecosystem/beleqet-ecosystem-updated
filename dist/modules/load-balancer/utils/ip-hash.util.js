"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashString = hashString;
exports.hashToIndex = hashToIndex;
function hashString(input) {
    let hash = 2_166_136_261;
    for (let index = 0; index < input.length; index += 1) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16_777_619);
    }
    return hash >>> 0;
}
function hashToIndex(hash, length) {
    return hash % length;
}
//# sourceMappingURL=ip-hash.util.js.map