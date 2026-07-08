/**
 * Advanced Search Service Implementation
 *
 * Implements the search business logic layer.
 * Follows Clean Architecture principles and includes validation,
 * i18n support, and error handling.
 */

import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { I18nService } from 'nestjs-i18n';
import { ISearchService, AvailableFilters } from './interfaces/search-service.interface';
import { SearchMeta, SearchCriteria, SearchResult } from './interfaces/search-repository.interface';
import {
  InvalidSearchFiltersException,
  RatingCalculationException,
} from './exceptions/search.exception';
import { SearchRepository } from './advanced-search.repository';
import { parseClientFeedback } from './types/client-feedback.types';
import { calculateRatingFromFeedback } from './utils/search-result.utils';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_PAGE,
  MAX_SEARCH_LIMIT,
  MAX_SKILLS_FILTER,
  SUPPORTED_CURRENCIES,
  VALID_LOCATIONS,
} from './constants/search.constants';

@Injectable()
export class AdvancedSearchService implements ISearchService {
  constructor(
    private readonly repository: SearchRepository,
    private readonly i18n: I18nService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) {}

  /**
   * Execute search with given criteria.
   * Validates filters, delegates to repository, formats response.
   */
  async executeSearch(criteria: SearchCriteria): Promise<{
    data: SearchResult[];
    meta: SearchMeta;
  }> {
    await this.validateFilters(criteria);

    const normalizedCriteria: SearchCriteria = {
      ...criteria,
      page: criteria.page ?? DEFAULT_SEARCH_PAGE,
      limit: criteria.limit ?? DEFAULT_SEARCH_LIMIT,
      sortBy: criteria.sortBy ?? 'relevance',
      entityType: criteria.entityType ?? 'all',
      currency: criteria.currency ?? 'ETB',
    };

    const cacheKey = `search:${JSON.stringify(normalizedCriteria)}`;
    const cachedResult = await this.cacheManager.get<{ data: SearchResult[]; meta: SearchMeta }>(
      cacheKey,
    );

    if (cachedResult) {
      return cachedResult;
    }

    let results: SearchResult[];

    switch (normalizedCriteria.entityType) {
      case 'freelancer':
        results = await this.repository.searchFreelancers(normalizedCriteria);
        break;
      case 'project':
        results = await this.repository.searchProjects(normalizedCriteria);
        break;
      case 'service':
        results = await this.repository.searchServices(normalizedCriteria);
        break;
      case 'all':
      default:
        results = await this.repository.searchAll(normalizedCriteria);
        break;
    }

    const total = await this.repository.getTotalCount(normalizedCriteria);
    const totalPages = total === 0 ? 0 : Math.ceil(total / normalizedCriteria.limit!);

    const result = {
      data: results,
      meta: {
        total,
        page: normalizedCriteria.page!,
        limit: normalizedCriteria.limit!,
        totalPages,
      },
    };

    await this.cacheManager.set(cacheKey, result);
    return result;
  }

  /**
   * Validate search filters.
   * Ensures price ranges, ratings, and other filters are valid.
   */
  async validateFilters(criteria: SearchCriteria): Promise<void> {
    if (criteria.minPrice !== undefined && criteria.maxPrice !== undefined) {
      if (criteria.minPrice > criteria.maxPrice) {
        throw new InvalidSearchFiltersException(
          this.i18n.t('search.invalid_price_range', {
            args: { min: criteria.minPrice, max: criteria.maxPrice },
          }),
        );
      }
    }

    if (criteria.minRating !== undefined && (criteria.minRating < 0 || criteria.minRating > 5)) {
      throw new InvalidSearchFiltersException(
        this.i18n.t('search.invalid_rating', { args: { rating: criteria.minRating } }),
      );
    }

    if (criteria.skills && criteria.skills.length > MAX_SKILLS_FILTER) {
      throw new InvalidSearchFiltersException(
        this.i18n.t('search.too_many_skills', { args: { count: criteria.skills.length } }),
      );
    }

    if (
      criteria.currency &&
      !SUPPORTED_CURRENCIES.includes(criteria.currency as (typeof SUPPORTED_CURRENCIES)[number])
    ) {
      throw new InvalidSearchFiltersException(
        this.i18n.t('search.invalid_currency', { args: { currency: criteria.currency } }),
      );
    }

    if (criteria.page !== undefined && criteria.page < 1) {
      throw new InvalidSearchFiltersException(
        this.i18n.t('search.invalid_page', { args: { page: criteria.page } }),
      );
    }

    if (criteria.limit !== undefined && (criteria.limit < 1 || criteria.limit > MAX_SEARCH_LIMIT)) {
      throw new InvalidSearchFiltersException(
        this.i18n.t('search.invalid_limit', { args: { limit: criteria.limit } }),
      );
    }

    if (criteria.location) {
      const isValidLocation = VALID_LOCATIONS.some(
        (loc) => loc.toLowerCase() === criteria.location!.toLowerCase(),
      );
      if (!isValidLocation) {
        throw new InvalidSearchFiltersException(
          this.i18n.t('search.invalid_location', { args: { location: criteria.location } }),
        );
      }
    }
  }

  /**
   * Get available filter options for UI components.
   */
  async getAvailableFilters(): Promise<AvailableFilters> {
    const skills = await this.repository.getDistinctSkills();

    const priceRanges: AvailableFilters['priceRanges'] = [
      { min: 0, max: 500, label: '0 - 500 ETB' },
      { min: 500, max: 1000, label: '500 - 1,000 ETB' },
      { min: 1000, max: 5000, label: '1,000 - 5,000 ETB' },
      { min: 5000, max: 10000, label: '5,000 - 10,000 ETB' },
      { min: 10000, max: 50000, label: '10,000 - 50,000 ETB' },
      { min: 50000, max: 100000, label: '50,000 - 100,000 ETB' },
      { min: 100000, max: null, label: '100,000+ ETB' },
    ];

    return {
      skills,
      locations: [...VALID_LOCATIONS],
      currencies: [...SUPPORTED_CURRENCIES],
      priceRanges,
    };
  }

  /**
   * Calculate rating from client feedback with validation.
   */
  calculateRating(clientFeedback: unknown): number {
    try {
      return calculateRatingFromFeedback(clientFeedback);
    } catch (error: any) {
      throw new RatingCalculationException(this.i18n.t('search.invalid_rating_value'));
    }
  }
}
