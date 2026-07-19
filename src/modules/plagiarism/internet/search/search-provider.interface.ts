/**
 * Contract for web search providers used by the internet source service.
 */
export interface ISearchProvider {
  /** Provider identifier. */
  readonly name: string;

  /**
   * Executes a web search and returns result URLs with titles.
   */
  search(query: string, maxResults: number): Promise<{ title: string; url: string; snippet?: string }[]>;
}
