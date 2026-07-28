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
Object.defineProperty(exports, "__esModule", { value: true });
exports.QualityAnalyzerService = void 0;
const common_1 = require("@nestjs/common");
const math_utils_1 = require("../utils/math.utils");
const tokenizer_service_1 = require("../tokenizer/tokenizer.service");
const MIN_WORDS_COMPLETE = 50;
const PROFESSIONAL_TERMS = new Set([
    'experience',
    'professional',
    'skills',
    'responsible',
    'develop',
    'manage',
    'implement',
    'deliver',
    'collaborate',
    'leadership',
    'strategy',
    'analysis',
    'requirements',
    'qualifications',
    'proficient',
    'expertise',
    'demonstrated',
]);
let QualityAnalyzerService = class QualityAnalyzerService {
    constructor(tokenizer) {
        this.tokenizer = tokenizer;
    }
    analyze(text, overallSimilarity) {
        const sentences = this.splitSentences(text);
        const words = text.split(/\s+/).filter(Boolean);
        const tokens = this.tokenizer.tokenize(text);
        return {
            originality: (0, math_utils_1.roundScore)(Math.max(0, 1 - overallSimilarity)),
            professionalLanguage: this.scoreProfessionalLanguage(tokens),
            readability: this.scoreReadability(words, sentences),
            contentCompleteness: this.scoreCompleteness(words, sentences),
            duplicateSentences: this.countDuplicateSentences(sentences),
            grammarWarnings: this.detectGrammarWarnings(text, sentences),
        };
    }
    computeQualityScore(assessment) {
        const grammarPenalty = Math.min(assessment.grammarWarnings.length * 0.05, 0.2);
        const duplicatePenalty = Math.min(assessment.duplicateSentences * 0.1, 0.3);
        const score = assessment.originality * 0.3 +
            assessment.professionalLanguage * 0.2 +
            assessment.readability * 0.2 +
            assessment.contentCompleteness * 0.3 -
            grammarPenalty -
            duplicatePenalty;
        return (0, math_utils_1.roundScore)(Math.max(0, Math.min(1, score)));
    }
    splitSentences(text) {
        return text
            .split(/(?<=[.!?])\s+/)
            .map((s) => s.trim())
            .filter((s) => s.length > 5);
    }
    scoreProfessionalLanguage(tokens) {
        if (tokens.length === 0)
            return 0;
        const professionalCount = tokens.filter((t) => PROFESSIONAL_TERMS.has(t)).length;
        return (0, math_utils_1.roundScore)(Math.min(1, professionalCount / Math.max(tokens.length * 0.1, 1)));
    }
    scoreReadability(words, sentences) {
        if (sentences.length === 0 || words.length === 0)
            return 0;
        const avgWordsPerSentence = words.length / sentences.length;
        const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
        let score = 1;
        if (avgWordsPerSentence > 35)
            score -= 0.3;
        else if (avgWordsPerSentence > 25)
            score -= 0.15;
        if (avgWordsPerSentence < 5)
            score -= 0.2;
        if (avgWordLength > 8)
            score -= 0.2;
        return (0, math_utils_1.roundScore)(Math.max(0, Math.min(1, score)));
    }
    scoreCompleteness(words, sentences) {
        let score = 0;
        if (words.length >= MIN_WORDS_COMPLETE)
            score += 0.5;
        if (sentences.length >= 3)
            score += 0.3;
        if (words.length >= MIN_WORDS_COMPLETE * 2)
            score += 0.2;
        return (0, math_utils_1.roundScore)(Math.min(1, score));
    }
    countDuplicateSentences(sentences) {
        const seen = new Set();
        let duplicates = 0;
        for (const sentence of sentences) {
            const normalized = sentence.toLowerCase().replace(/\s+/g, ' ');
            if (seen.has(normalized))
                duplicates++;
            else
                seen.add(normalized);
        }
        return duplicates;
    }
    detectGrammarWarnings(text, sentences) {
        const warnings = [];
        if (/\s{2,}/.test(text)) {
            warnings.push('Multiple consecutive spaces detected');
        }
        if (/[a-z][A-Z]/.test(text.replace(/\s/g, ''))) {
            warnings.push('Possible missing space between sentences');
        }
        for (const sentence of sentences) {
            if (sentence.length > 0 && sentence[0] === sentence[0].toLowerCase()) {
                warnings.push('Sentence may not start with a capital letter');
                break;
            }
        }
        if ((text.match(/!/g) ?? []).length > 3) {
            warnings.push('Excessive exclamation marks');
        }
        if (text.includes('  .') || text.includes(' ,')) {
            warnings.push('Space before punctuation detected');
        }
        return warnings.slice(0, 5);
    }
};
exports.QualityAnalyzerService = QualityAnalyzerService;
exports.QualityAnalyzerService = QualityAnalyzerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [tokenizer_service_1.TokenizerService])
], QualityAnalyzerService);
//# sourceMappingURL=quality-analyzer.service.js.map