export interface ITokenizer {
    tokenize(text: string): string[];
    tokenizeCached(text: string): string[];
}
