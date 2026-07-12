/**
 * Search Filters DTO
 *
 * Data Transfer Object for search filter validation.
 * Contains additional validation logic for complex filter scenarios.
 */

import {
  IsString,
  IsArray,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Max,
  validateSync,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SearchFiltersDto {
  @ApiPropertyOptional({
    description: 'Comma-separated skills string',
    example: 'React,Node.js,TypeScript',
  })
  @IsOptional()
  @IsString()
  skillsString?: string;

  @ApiPropertyOptional({
    description: 'Array of skills',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiPropertyOptional({
    description: 'Minimum price',
    example: 100,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Maximum price',
    example: 500,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    description: 'Currency',
    example: 'ETB',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Minimum rating',
    example: 4,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Location',
    example: 'Addis Ababa',
  })
  @IsOptional()
  @IsString()
  location?: string;

  /**
   * Custom validation to ensure price range is valid
   */
  validatePriceRange() {
    if (this.minPrice !== undefined && this.maxPrice !== undefined) {
      if (this.minPrice > this.maxPrice) {
        throw new Error('minPrice must be less than or equal to maxPrice');
      }
    }
  }

  /**
   * Transform comma-separated skills string to array
   */
  @Transform(({ value }) => {
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
    return value;
  })
  transformSkills(): void {
    // This is handled by the Transform decorator
  }
}
