# Beleqet Frontend - Advanced Search Module

Next.js frontend for the Beleqet Advanced Search functionality.

## Features

- **Advanced Search**: Search for freelancers, projects, and services with multiple filters
- **i18n Support**: English and Amharic translations
- **Multi-currency**: Support for ETB, USD, EUR
- **Responsive Design**: Mobile-friendly UI with Tailwind CSS
- **Real-time Search**: Instant search with loading states
- **Filter Options**: Entity type, price range, rating, skills, location, sorting

## Installation

```bash
npm install
```

## Development

```bash
npm run dev
```

The application will be available at `http://localhost:3000`

## Build

```bash
npm run build
npm start
```

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
```

## Docker

Build and run with Docker:

```bash
docker-compose up frontend
```

## Components

- `AdvancedSearch`: Main search component with input and filters
- `SearchFilters`: Filter panel with all search options
- `SearchResults`: Display search results with cards
- `LanguageSwitcher`: Toggle between English and Amharic

## API Integration

The frontend communicates with the backend API at `/api/v1/advanced-search` with the following query parameters:

- `keyword`: Search term
- `entityType`: Filter by entity type (ALL, FREELANCER, PROJECT, SERVICE)
- `minPrice`/`maxPrice`: Price range filter
- `currency`: Currency for price filtering (ETB, USD, EUR)
- `minRating`: Minimum rating (0-5)
- `skills`: Comma-separated skills
- `location`: Location filter
- `sortBy`: Sort option (RELEVANCE, RATING_DESC, RATING_ASC, PRICE_ASC, PRICE_DESC, DATE_DESC)
- `page`: Page number for pagination
- `limit`: Results per page

## i18n

Translations are located in `src/lib/i18n.ts` with support for:
- English (en)
- Amharic (am)

The language context provides a `t()` function for accessing translations.

## GDPR Compliance

This frontend only displays public professional information:
- Professional titles and descriptions
- Skills and qualifications
- Public ratings and reviews
- Location preferences
- Public pricing information

No personal data (email, phone, address, financial info) is displayed or collected.
