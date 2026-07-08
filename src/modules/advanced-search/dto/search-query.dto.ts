/**
 * Search Query DTO
 *
 * Data Transfer Object for search query parameters.
 * Validation is handled in the service layer for i18n support.
 */

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { SearchEntityType, SearchSortOption } from './search.enums';
import { SearchCriteria } from '../interfaces/search-repository.interface';
import {
  DEFAULT_SEARCH_LIMIT,
  DEFAULT_SEARCH_PAGE,
  MAX_SEARCH_LIMIT,
  SUPPORTED_CURRENCIES,
} from '../constants/search.constants';

export { SearchEntityType, SearchSortOption };

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Keyword to search for in titles, descriptions, and profiles',
    example: 'React Developer',
  })
  keyword?: string;

  @ApiPropertyOptional({
    description: 'Filter by entity type',
    enum: SearchEntityType,
    default: SearchEntityType.ALL,
  })
  entityType?: SearchEntityType;

  @ApiPropertyOptional({
    description: 'Minimum price filter',
    example: 100,
    minimum: 0,
  })
  @Transform(({ value }) => value ? Number(value) : undefined)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price filter',
    example: 500,
    maximum: 10000000,
  })
  @Transform(({ value }) => value ? Number(value) : undefined)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Currency for price filtering',
    example: 'ETB',
    enum: SUPPORTED_CURRENCIES,
  })
  currency?: string;

  @ApiPropertyOptional({
    description: 'Minimum rating filter (0-5)',
    example: 4,
    minimum: 0,
    maximum: 5,
  })
  @Transform(({ value }) => value ? Number(value) : undefined)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Skills to filter by (comma-separated string or array)',
    example: 'React,Node.js,TypeScript',
    type: String,
  })
  @Transform(({ value }: { value: string | string[] | undefined }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((skill) => skill.trim())
        .filter((skill) => skill.length > 0);
    }
    return value;
  })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Location filter',
    example: 'Addis Ababa',
  })
  location?: string;

  @ApiPropertyOptional({
    description: 'Sort option for results',
    enum: SearchSortOption,
    default: SearchSortOption.RELEVANCE,
  })
  sortBy?: SearchSortOption;

  @ApiPropertyOptional({
    description: 'Page number for pagination',
    example: 1,
    minimum: 1,
    default: DEFAULT_SEARCH_PAGE,
  })
  @Transform(({ value }) => value ? Number(value) : undefined)
  page?: number;

  @ApiPropertyOptional({
    description: 'Number of results per page',
    example: 20,
    minimum: 1,
    maximum: MAX_SEARCH_LIMIT,
    default: DEFAULT_SEARCH_LIMIT,
  })
  @Transform(({ value }) => value ? Number(value) : undefined)
  limit?: number;

  /**
   * Convert validated query DTO to repository search criteria.
   */
  toSearchCriteria(): SearchCriteria {
    return {
      keyword: this.keyword,
      entityType: this.entityType,
      minPrice: this.minPrice,
      maxPrice: this.maxPrice,
      currency: this.currency,
      minRating: this.minRating,
      skills: this.skills,
      location: this.location,
      sortBy: this.sortBy,
      page: this.page,
      limit: this.limit,
    };
  }
}
