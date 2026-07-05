import { ITokenizer } from './tokenizer.interface';
export declare class TokenizerService implements ITokenizer {
    tokenize(text: string): string[];
}
