/**
 * Search Response DTO
 *
 * Data Transfer Object for search response formatting.
 * Defines the structure of search results returned to clients.
 */

import { ApiProperty } from '@nestjs/swagger';

export class PriceInfoDto {
  @ApiProperty({
    description: 'Minimum price',
    example: 100,
  })
  min?: number;

  @ApiProperty({
    description: 'Maximum price',
    example: 500,
  })
  max?: number;

  @ApiProperty({
    description: 'Currency code',
    example: 'ETB',
  })
  currency: string;
}

export class SearchResultDto {
  @ApiProperty({
    description: 'Unique identifier',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Entity type',
    enum: ['freelancer', 'project', 'service'],
    example: 'freelancer',
  })
  type: 'freelancer' | 'project' | 'service';

  @ApiProperty({
    description: 'Title or name',
    example: 'Senior React Developer',
  })
  title: string;

  @ApiProperty({
    description: 'Description or bio',
    example: 'Experienced React developer with 5 years of experience',
    required: false,
  })
  description?: string;

  @ApiProperty({
    description: 'Price information',
    type: PriceInfoDto,
    required: false,
  })
  price?: PriceInfoDto;

  @ApiProperty({
    description: 'Average rating (0-5)',
    example: 4.5,
    required: false,
  })
  rating?: number;

  @ApiProperty({
    description: 'List of skills',
    example: ['React', 'Node.js', 'TypeScript'],
    type: [String],
  })
  skills: string[];

  @ApiProperty({
    description: 'Location',
    example: 'Addis Ababa',
    required: false,
  })
  location?: string;

  @ApiProperty({
    description: 'Avatar or profile image URL',
    example: 'https://example.com/avatar.jpg',
    required: false,
  })
  avatarUrl?: string;

  @ApiProperty({
    description: 'Creation date',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

export class SearchMetaDto {
  @ApiProperty({
    description: 'Total number of results',
    example: 100,
  })
  total: number;

  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of results per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 5,
  })
  totalPages: number;
}

export class SearchResponseDto {
  @ApiProperty({
    description: 'Array of search results',
    type: [SearchResultDto],
  })
  data: SearchResultDto[];

  @ApiProperty({
    description: 'Pagination metadata',
    type: SearchMetaDto,
  })
  meta: SearchMetaDto;
}
