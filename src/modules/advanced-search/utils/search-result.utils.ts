import { SearchCriteria, SearchResult } from '../interfaces/search-repository.interface';
import { parseClientFeedback } from '../types/client-feedback.types';

/**
 * Calculate average rating (0-5) from client feedback entries.
 * Validates that each rating entry is between 0 and 5.
 */
export function calculateRatingFromFeedback(feedback: unknown): number {
  const entries = parseClientFeedback(feedback);

  if (entries.length === 0) {
    return 0;
  }

  let totalRating = 0;
  let ratingCount = 0;

  for (const entry of entries) {
    if (typeof entry.rating === 'number') {
      if (entry.rating < 0 || entry.rating > 5) {
        throw new Error('Invalid rating value. Rating must be between 0 and 5');
      }
      totalRating += entry.rating;
      ratingCount++;
    }
  }

  return ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : 0;
}

/**
 * Extract a comparable price value for sorting (uses minimum price when available).
 */
export function getComparablePrice(result: SearchResult): number {
  if (!result.price) {
    return Number.MAX_SAFE_INTEGER;
  }

  return result.price.min ?? result.price.max ?? Number.MAX_SAFE_INTEGER;
}

/**
 * Score relevance based on keyword matches across searchable fields.
 */
export function getRelevanceScore(result: SearchResult, keyword?: string): number {
  if (!keyword) {
    return 0;
  }

  const normalizedKeyword = keyword.toLowerCase();
  let score = 0;
  const fields = [result.title, result.description ?? '', result.location ?? '', ...result.skills];

  for (const field of fields) {
    const normalizedField = field.toLowerCase();
    if (normalizedField === normalizedKeyword) {
      score += 5;
    } else if (normalizedField.startsWith(normalizedKeyword)) {
      score += 3;
    } else if (normalizedField.includes(normalizedKeyword)) {
      score += 1;
    }
  }

  return score;
}

/**
 * Sort search results according to the requested strategy.
 */
export function sortSearchResults(
  results: SearchResult[],
  sortBy: SearchCriteria['sortBy'] = 'relevance',
  keyword?: string,
): SearchResult[] {
  const sorted = [...results];

  switch (sortBy) {
    case 'rating':
      sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
      break;
    case 'price_asc':
      sorted.sort((a, b) => getComparablePrice(a) - getComparablePrice(b));
      break;
    case 'price_desc':
      sorted.sort((a, b) => getComparablePrice(b) - getComparablePrice(a));
      break;
    case 'newest':
      sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      break;
    case 'relevance':
    default:
      if (keyword) {
        sorted.sort((a, b) => {
          const scoreDiff = getRelevanceScore(b, keyword) - getRelevanceScore(a, keyword);
          if (scoreDiff !== 0) {
            return scoreDiff;
          }
          return b.createdAt.getTime() - a.createdAt.getTime();
        });
      } else {
        sorted.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
      break;
  }

  return sorted;
}

/**
 * Apply minimum rating filter to in-memory results.
 */
export function filterByMinRating(results: SearchResult[], minRating?: number): SearchResult[] {
  if (minRating === undefined) {
    return results;
  }

  return results.filter((result) => (result.rating ?? 0) >= minRating);
}

/**
 * Paginate an in-memory result set.
 */
export function paginateResults<T>(results: T[], page = 1, limit = 20): T[] {
  const skip = (page - 1) * limit;
  return results.slice(skip, skip + limit);
}
