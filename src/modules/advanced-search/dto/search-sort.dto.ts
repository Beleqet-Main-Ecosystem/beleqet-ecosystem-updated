/**
 * Search Sort DTO
 *
 * Data Transfer Object for search sort options.
 */

import { IsEnum, IsOptional, IsIn } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SearchSortOption } from './search.enums';

export { SearchSortOption };

export class SearchSortDto {
  @ApiPropertyOptional({
    description: 'Sort option for results',
    enum: SearchSortOption,
    default: SearchSortOption.RELEVANCE,
    example: SearchSortOption.RATING,
  })
  @IsOptional()
  @IsEnum(SearchSortOption)
  sortBy?: SearchSortOption;

  @ApiPropertyOptional({
    description: 'Sort direction (for custom sort implementations)',
    enum: ['asc', 'desc'],
    default: 'desc',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDirection?: 'asc' | 'desc';
}
