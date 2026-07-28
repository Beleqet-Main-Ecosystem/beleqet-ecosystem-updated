import { QualityAssessment } from '../types/plagiarism.types';
import { TokenizerService } from '../tokenizer/tokenizer.service';
export declare class QualityAnalyzerService {
    private readonly tokenizer;
    constructor(tokenizer: TokenizerService);
    analyze(text: string, overallSimilarity: number): QualityAssessment;
    computeQualityScore(assessment: QualityAssessment): number;
    private splitSentences;
    private scoreProfessionalLanguage;
    private scoreReadability;
    private scoreCompleteness;
    private countDuplicateSentences;
    private detectGrammarWarnings;
}
