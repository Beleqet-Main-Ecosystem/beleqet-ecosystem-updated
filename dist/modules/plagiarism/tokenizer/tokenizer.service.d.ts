import { ITokenizer } from './tokenizer.interface';
export declare class TokenizerService implements ITokenizer {
    private readonly cache;
    tokenize(text: string): string[];
    tokenizeCached(text: string): string[];
    clearCache(): void;
}
