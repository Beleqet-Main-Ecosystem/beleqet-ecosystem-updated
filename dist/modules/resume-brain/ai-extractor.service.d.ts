import { AiChatProvider, AiUsage } from './ai/ai-chat-provider.interface';
import { ExtractedResume } from './dto/extracted-resume.dto';
export interface ExtractionResult {
    resume: ExtractedResume;
    usage: AiUsage;
}
export declare class AIExtractorService {
    private readonly provider;
    private readonly logger;
    constructor(provider: AiChatProvider);
    get providerName(): string;
    extract(text: string): Promise<ExtractionResult>;
    private sanitize;
    private buildUserPrompt;
    private parseJson;
    private firstJsonObject;
    private normalize;
    private str;
    private strArray;
    private educationArray;
    private experienceArray;
    private toHttpException;
}
