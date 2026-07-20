import { Injectable } from '@nestjs/common';
import { QualityAssessment } from '../types/plagiarism.types';
import { roundScore } from '../utils/math.utils';
import { TokenizerService } from '../tokenizer/tokenizer.service';

/** Minimum word count considered a complete piece of content. */
const MIN_WORDS_COMPLETE = 50;

/** Professional vocabulary indicators. */
const PROFESSIONAL_TERMS = new Set([
  'experience', 'professional', 'skills', 'responsible', 'develop', 'manage',
  'implement', 'deliver', 'collaborate', 'leadership', 'strategy', 'analysis',
  'requirements', 'qualifications', 'proficient', 'expertise', 'demonstrated',
]);

/**
 * Generates quality assessment metrics for submitted text using simple heuristics.
 */
@Injectable()
export class QualityAnalyzerService {
  constructor(private readonly tokenizer: TokenizerService) {}

  /**
   * Analyzes text quality across originality proxies, readability, and grammar heuristics.
   */
  analyze(text: string, overallSimilarity: number): QualityAssessment {
    const sentences = this.splitSentences(text);
    const words = text.split(/\s+/).filter(Boolean);
    const tokens = this.tokenizer.tokenize(text);

    return {
      originality: roundScore(Math.max(0, 1 - overallSimilarity)),
      professionalLanguage: this.scoreProfessionalLanguage(tokens),
      readability: this.scoreReadability(words, sentences),
      contentCompleteness: this.scoreCompleteness(words, sentences),
      duplicateSentences: this.countDuplicateSentences(sentences),
      grammarWarnings: this.detectGrammarWarnings(text, sentences),
    };
  }

  /**
   * Computes an overall quality score from assessment metrics.
   */
  computeQualityScore(assessment: QualityAssessment): number {
    const grammarPenalty = Math.min(assessment.grammarWarnings.length * 0.05, 0.2);
    const duplicatePenalty = Math.min(assessment.duplicateSentences * 0.1, 0.3);

    const score =
      assessment.originality * 0.3 +
      assessment.professionalLanguage * 0.2 +
      assessment.readability * 0.2 +
      assessment.contentCompleteness * 0.3 -
      grammarPenalty -
      duplicatePenalty;

    return roundScore(Math.max(0, Math.min(1, score)));
  }

  private splitSentences(text: string): string[] {
    return text
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 5);
  }

  private scoreProfessionalLanguage(tokens: string[]): number {
    if (tokens.length === 0) return 0;
    const professionalCount = tokens.filter((t) => PROFESSIONAL_TERMS.has(t)).length;
    return roundScore(Math.min(1, professionalCount / Math.max(tokens.length * 0.1, 1)));
  }

  private scoreReadability(words: string[], sentences: string[]): number {
    if (sentences.length === 0 || words.length === 0) return 0;
    const avgWordsPerSentence = words.length / sentences.length;
    const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;

    let score = 1;
    if (avgWordsPerSentence > 35) score -= 0.3;
    else if (avgWordsPerSentence > 25) score -= 0.15;
    if (avgWordsPerSentence < 5) score -= 0.2;
    if (avgWordLength > 8) score -= 0.2;

    return roundScore(Math.max(0, Math.min(1, score)));
  }

  private scoreCompleteness(words: string[], sentences: string[]): number {
    let score = 0;
    if (words.length >= MIN_WORDS_COMPLETE) score += 0.5;
    if (sentences.length >= 3) score += 0.3;
    if (words.length >= MIN_WORDS_COMPLETE * 2) score += 0.2;
    return roundScore(Math.min(1, score));
  }

  private countDuplicateSentences(sentences: string[]): number {
    const seen = new Set<string>();
    let duplicates = 0;
    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/\s+/g, ' ');
      if (seen.has(normalized)) duplicates++;
      else seen.add(normalized);
    }
    return duplicates;
  }

  private detectGrammarWarnings(text: string, sentences: string[]): string[] {
    const warnings: string[] = [];

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
}
