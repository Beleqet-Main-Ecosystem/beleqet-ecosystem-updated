"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roundScore = roundScore;
exports.cosineSimilarity = cosineSimilarity;
exports.termFrequency = termFrequency;
exports.tfToVector = tfToVector;
function roundScore(score) {
    return Math.round(score * 10_000) / 10_000;
}
function cosineSimilarity(a, b) {
    if (a.length === 0 || b.length === 0 || a.length !== b.length)
        return 0;
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
function termFrequency(tokens) {
    const tf = new Map();
    for (const token of tokens) {
        tf.set(token, (tf.get(token) ?? 0) + 1);
    }
    return tf;
}
function tfToVector(tf, vocabulary) {
    return vocabulary.map((term) => tf.get(term) ?? 0);
}
//# sourceMappingURL=math.utils.js.map