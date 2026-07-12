/**
 * Search Repository Interface
 *
 * Defines the contract for search data access operations.
 * Following Clean Architecture principles, this interface abstracts
 * the data layer from the business logic layer.
 */

export interface SearchCriteria {
  keyword?: string;
  entityType?: 'freelancer' | 'project' | 'service' | 'all';
  minPrice?: number;
  maxPrice?: number;
  currency?: string;
  minRating?: number;
  skills?: string[];
  location?: string;
  sortBy?: 'rating' | 'price_asc' | 'price_desc' | 'newest' | 'relevance';
  page?: number;
  limit?: number;
}

export interface SearchResult {
  id: string;
  type: 'freelancer' | 'project' | 'service';
  title: string;
  description?: string | null;
  price?: {
    min?: number;
    max?: number;
    currency: string;
  };
  rating?: number;
  skills: string[];
  location?: string | null;
  avatarUrl?: string | null;
  createdAt: Date;
}

export interface SearchMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ISearchRepository {
  /**
   * Search for freelancers based on criteria
   * @param criteria - Search criteria including filters and pagination
   * @returns Array of freelancer search results
   */
  searchFreelancers(criteria: SearchCriteria): Promise<SearchResult[]>;

  /**
   * Search for projects based on criteria
   * @param criteria - Search criteria including filters and pagination
   * @returns Array of project search results
   */
  searchProjects(criteria: SearchCriteria): Promise<SearchResult[]>;

  /**
   * Search for services based on criteria
   * @param criteria - Search criteria including filters and pagination
   * @returns Array of service search results
   */
  searchServices(criteria: SearchCriteria): Promise<SearchResult[]>;

  /**
   * Search across all entity types
   * @param criteria - Search criteria including filters and pagination
   * @returns Array of mixed search results
   */
  searchAll(criteria: SearchCriteria): Promise<SearchResult[]>;

  /**
   * Get total count for pagination
   * @param criteria - Search criteria
   * @returns Total number of results
   */
  getTotalCount(criteria: SearchCriteria): Promise<number>;

  /**
   * Get distinct skills/tags available across searchable entities
   */
  getDistinctSkills(): Promise<string[]>;
}
