/**
 * Contract for text tokenization used by similarity strategies.
 */
export interface ITokenizer {
  /**
   * Converts raw text into a normalized list of meaningful tokens.
   */
  tokenize(text: string): string[];
}
