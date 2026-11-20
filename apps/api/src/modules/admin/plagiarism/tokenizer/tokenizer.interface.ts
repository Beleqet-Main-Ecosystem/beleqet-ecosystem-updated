/**
 * Contract for text tokenization used by similarity strategies.
 */
export interface ITokenizer {
  /**
   * Converts raw text into a normalized list of meaningful tokens.
   */
  tokenize(text: string): string[];

  /**
   * Returns cached tokens for a text, tokenizing on first access.
   */
  tokenizeCached(text: string): string[];
}
