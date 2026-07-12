# Advanced Search Module

## Overview
The Advanced Search module provides powerful search functionality across freelancers, projects, and services in the Beleqet ecosystem. It supports filtering, sorting, pagination, and multi-currency search with GDPR compliance.

## Features
- **Multi-entity search**: Search across freelancers, projects, and services
- **Advanced filtering**: Filter by price range, rating, skills, location, and more
- **Multi-currency support**: ETB, USD, EUR
- **GDPR compliant**: Sensitive data excluded from search results
- **Internationalization**: English and Amharic translations
- **Rate limiting**: Built-in throttling for API protection
- **Optimized queries**: GIN indexes for array searches, composite indexes for common filters

## Architecture

### Module Structure
```
src/modules/advanced-search/
├── advanced-search.module.ts          # Module definition
├── advanced-search.controller.ts      # HTTP endpoints
├── advanced-search.service.ts         # Business logic
├── advanced-search.repository.ts      # Data access layer
├── dto/
│   ├── search-query.dto.ts           # Request validation
│   ├── search-response.dto.ts        # Response formatting
│   ├── search-filters.dto.ts          # Filter validation
│   └── search-sort.dto.ts             # Sort validation
├── interfaces/
│   ├── search-repository.interface.ts # Repository interface
│   └── search-service.interface.ts    # Service interface
├── exceptions/
│   └── search.exception.ts            # Custom exceptions
└── advanced-search.service.spec.ts    # Unit tests
```

## API Endpoints

### Search Endpoint
**GET** `/api/v1/advanced-search`

Search across freelancers, projects, and services with advanced filters.

**Query Parameters:**
- `keyword` (string, optional): Search term for title, description, bio
- `entityType` (enum, optional): `freelancer` | `project` | `service` | `all`
- `minPrice` (number, optional): Minimum price/budget
- `maxPrice` (number, optional): Maximum price/budget
- `currency` (string, optional): `ETB` | `USD` | `EUR`
- `minRating` (number, optional): Minimum rating (0-5)
- `skills` (string, optional): Comma-separated skills (e.g., "React,Node.js")
- `location` (string, optional): Location filter
- `sortBy` (enum, optional): `rating` | `price_asc` | `price_desc` | `newest` | `relevance`
- `page` (number, optional): Page number (default: 1)
- `limit` (number, optional): Results per page (default: 20, max: 100)

**Example:**
```bash
curl "http://localhost:4000/api/v1/advanced-search?keyword=react&skills=React,Node.js&location=Addis%20Ababa&page=1&limit=20"
```

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "type": "freelancer",
      "title": "Full Stack Developer",
      "description": "Experienced developer...",
      "price": {
        "min": 1000,
        "max": 5000,
        "currency": "ETB"
      },
      "rating": 4.5,
      "skills": ["React", "Node.js"],
      "location": "Addis Ababa",
      "avatarUrl": "https://...",
      "createdAt": "2024-01-01T00:00:00Z"
    }
  ],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5
  }
}
```

### Filters Endpoint
**GET** `/api/v1/advanced-search/filters`

Get available filter options for UI components.

**Response:**
```json
{
  "skills": ["AI/ML", "AWS", "React", "Node.js", ...],
  "locations": ["Addis Ababa", "Bahir Dar", "Remote", ...],
  "currencies": ["ETB", "USD", "EUR"],
  "priceRanges": [
    {"min": 0, "max": 500, "label": "0 - 500 ETB"},
    {"min": 500, "max": 1000, "label": "500 - 1,000 ETB"},
    ...
  ]
}
```

## Validation Rules

### Price Range
- `minPrice` must be less than or equal to `maxPrice`
- Both values must be non-negative

### Rating
- Rating must be between 0 and 5

### Skills
- Maximum 20 skills per search
- Skills are comma-separated in query string

### Currency
- Only accepts: `ETB`, `USD`, `EUR`

### Pagination
- `page` must be greater than 0
- `limit` must be between 1 and 100

## GDPR Compliance

The search module excludes sensitive user data from results:
- ❌ `passwordHash`
- ❌ `email`
- ❌ `phone`
- ❌ `telegramId`
- ❌ `emailVerified`

Only public profile information is returned:
- ✅ `id`, `firstName`, `lastName`
- ✅ `headline`, `bio`, `location`
- ✅ `skills`, `rating`
- ✅ `avatarUrl`, `portfolioUrl`, `githubUrl`, `linkedinUrl`

## Database Optimization

### GIN Indexes
- `users_skills_gin_idx` on `users.skills`
- `jobs_tags_gin_idx` on `jobs.tags`
- `freelance_jobs_skills_gin_idx` on `freelance_jobs.skills`

### Composite Indexes
- `users`: `[role, isActive]`, `[location]`
- `jobs`: `[location, status]`, `[status, featured]`
- `freelance_jobs`: `[status, featured]`, `[locationPreference, status]`, `[categoryId, status]`

## Internationalization

### Supported Languages
- English (`en`)
- Amharic (`am`)

### Translation Keys
```json
{
  "search": {
    "title": "Advanced Search",
    "invalid_price_range": "Minimum price must be less than or equal to maximum price",
    "invalid_rating": "Invalid rating. Rating must be between 0 and 5",
    ...
  }
}
```

## Error Handling

### Custom Exceptions
- `InvalidSearchFiltersException`: Invalid filter parameters (400)
- `CurrencyConversionException`: Currency conversion errors (500)
- `RatingCalculationException`: Rating calculation errors (500)

### Error Response Format
```json
{
  "statusCode": 400,
  "timestamp": "2024-01-01T00:00:00Z",
  "path": "/api/v1/advanced-search",
  "message": "Invalid search filters"
}
```

## Testing

### Run Unit Tests
```bash
npm test -- advanced-search.service.spec.ts
```

### Manual Testing
```bash
# Basic search
curl "http://localhost:4000/api/v1/advanced-search?keyword=test"

# With filters
curl "http://localhost:4000/api/v1/advanced-search?skills=React,Node.js&minPrice=1000&maxPrice=5000"

# Get filters
curl "http://localhost:4000/api/v1/advanced-search/filters"
```

## Dependencies

### Required
- `@nestjs/common`
- `@nestjs/swagger`
- `@nestjs/throttler`
- `nestjs-i18n`
- `class-validator`
- `class-transformer`
- `@prisma/client`

### Optional
- `I18nService` (for internationalization)

## Future Enhancements

- [ ] Full-text search with PostgreSQL tsvector
- [ ] Elasticsearch integration for large-scale search
- [ ] Search analytics and tracking
- [ ] Personalized search results for authenticated users
- [ ] Advanced relevance scoring algorithm
- [ ] Search suggestions and autocomplete
- [ ] Saved search queries
- [ ] Search history
