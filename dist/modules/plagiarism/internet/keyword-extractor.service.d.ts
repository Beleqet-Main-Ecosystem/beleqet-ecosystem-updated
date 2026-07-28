import { TokenizerService } from '../tokenizer/tokenizer.service';
export declare class KeywordExtractorService {
    private readonly tokenizer;
    constructor(tokenizer: TokenizerService);
    extractQuery(text: string): string;
}
