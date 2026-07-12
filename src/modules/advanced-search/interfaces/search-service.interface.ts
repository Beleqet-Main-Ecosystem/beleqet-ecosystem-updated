/**
 * Search Service Interface
 *
 * Defines the contract for search business logic operations.
 * Following Clean Architecture principles, this interface abstracts
 * the business logic from the presentation layer.
 */

import { SearchResult, SearchMeta, SearchCriteria } from './search-repository.interface';

export interface AvailableFilters {
  skills: string[];
  locations: string[];
  currencies: string[];
  priceRanges: Array<{ min: number; max: number | null; label: string }>;
}

export interface ISearchService {
  /**
   * Execute search with given criteria
   * @param criteria - Search criteria including filters and pagination
   * @returns Search results with metadata
   */
  executeSearch(criteria: SearchCriteria): Promise<{
    data: SearchResult[];
    meta: SearchMeta;
  }>;

  /**
   * Validate search filters
   * @param criteria - Search criteria to validate
   * @throws InvalidSearchFiltersException if validation fails
   */
  validateFilters(criteria: SearchCriteria): Promise<void>;

  /**
   * Get available filter options
   * @returns Available filter values for UI
   */
  getAvailableFilters(): Promise<AvailableFilters>;

  /**
   * Calculate rating from client feedback
   * @param clientFeedback - Client feedback JSON data
   * @returns Average rating (0-5)
   */
  calculateRating(clientFeedback: unknown): number;
}
