/**
 * Advanced Search Controller
 *
 * Handles HTTP requests for the advanced search functionality.
 * Provides Swagger documentation and follows NestJS controller patterns.
 */

import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AdvancedSearchService } from './advanced-search.service';
import { SearchQueryDto, SearchEntityType, SearchSortOption } from './dto/search-query.dto';
import { SearchResponseDto } from './dto/search-response.dto';
import { AvailableFilters } from './interfaces/search-service.interface';

@ApiTags('advanced-search')
@Controller('advanced-search')
@UseGuards(ThrottlerGuard)
export class AdvancedSearchController {
  constructor(private readonly searchService: AdvancedSearchService) {}

  /**
   * Main search endpoint
   * Supports keyword search, filtering, sorting, and pagination
   */
  @Get()
  @ApiOperation({
    summary: 'Advanced search across freelancers, projects, and services',
    description:
      'Search with filters for price, rating, skills, location, and sorting options. Results are cached for performance.',
  })
  @ApiQuery({
    name: 'keyword',
    required: false,
    example: 'React Developer',
    description: 'Search keyword for titles, descriptions, and profiles',
  })
  @ApiQuery({
    name: 'entityType',
    required: false,
    enum: SearchEntityType,
    example: SearchEntityType.FREELANCER,
    description: 'Filter by entity type (freelancer, project, service, or all)',
  })
  @ApiQuery({
    name: 'minPrice',
    required: false,
    example: 100,
    description: 'Minimum price filter',
  })
  @ApiQuery({
    name: 'maxPrice',
    required: false,
    example: 500,
    description: 'Maximum price filter',
  })
  @ApiQuery({
    name: 'currency',
    required: false,
    example: 'ETB',
    description: 'Currency for price filtering (ETB, USD, EUR)',
  })
  @ApiQuery({
    name: 'minRating',
    required: false,
    example: 4,
    description: 'Minimum rating filter (0-5)',
  })
  @ApiQuery({
    name: 'skills',
    required: false,
    example: 'React,Node.js,TypeScript',
    description: 'Skills filter (comma-separated string)',
  })
  @ApiQuery({
    name: 'location',
    required: false,
    example: 'Addis Ababa',
    description: 'Location filter (Ethiopian cities or Remote)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    enum: SearchSortOption,
    example: SearchSortOption.RATING,
    description: 'Sort option (relevance, rating, price_asc, price_desc, date)',
  })
  @ApiQuery({ name: 'page', required: false, example: 1, description: 'Page number (default: 1)' })
  @ApiQuery({
    name: 'limit',
    required: false,
    example: 20,
    description: 'Results per page (default: 20, max: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Search results returned successfully',
    type: SearchResponseDto,
    schema: {
      example: {
        data: [
          {
            id: '123',
            type: 'freelancer',
            title: 'React Developer',
            description: 'Experienced React developer with 5 years of experience',
            price: 50,
            currency: 'ETB',
            rating: 4.5,
            skills: ['React', 'Node.js', 'TypeScript'],
            location: 'Addis Ababa',
            avatarUrl: 'https://example.com/avatar.jpg',
            createdAt: '2024-01-01T00:00:00Z',
          },
        ],
        meta: {
          total: 100,
          page: 1,
          limit: 20,
          totalPages: 5,
        },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid search filters provided',
    schema: {
      example: {
        statusCode: 400,
        message: 'Minimum price must be less than or equal to maximum price',
        error: 'Bad Request',
      },
    },
  })
  @ApiResponse({
    status: 503,
    description: 'Search service temporarily unavailable',
    schema: {
      example: {
        statusCode: 503,
        message: 'Search service temporarily unavailable',
        error: 'Service Unavailable',
      },
    },
  })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    const result = await this.searchService.executeSearch(query.toSearchCriteria());
    return result as SearchResponseDto;
  }

  /**
   * Get available filter options
   * Returns available values for UI filter components
   */
  @Get('filters')
  @ApiOperation({
    summary: 'Get available filter options',
    description:
      'Returns available skills, locations, currencies, and price ranges for filtering UI components',
  })
  @ApiResponse({
    status: 200,
    description: 'Available filters returned successfully',
    schema: {
      example: {
        skills: ['React', 'Node.js', 'TypeScript', 'Python', 'Java'],
        locations: [
          'Addis Ababa',
          'Bahir Dar',
          'Hawassa',
          'Mekelle',
          'Adama',
          'Dire Dawa',
          'Gondar',
          'Jimma',
          'Remote',
        ],
        currencies: ['ETB', 'USD', 'EUR'],
        priceRanges: [
          { min: 0, max: 100 },
          { min: 100, max: 500 },
          { min: 500, max: 1000 },
          { min: 1000, max: 5000 },
          { min: 5000, max: null },
        ],
      },
    },
  })
  async getFilters(): Promise<AvailableFilters> {
    return this.searchService.getAvailableFilters();
  }
}
