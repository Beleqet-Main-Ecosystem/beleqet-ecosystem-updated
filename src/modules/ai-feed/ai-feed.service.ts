import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AiFeedService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get personalized job feed for a specific user.
   * 
   * If the user has disabled GDPR consent, returns the latest 5 published jobs generically.
   * Otherwise, extracts keywords from the user's search history (last 30 days),
   * scores all published jobs by keyword frequency in title/description/tags,
   * and returns the top `limit` results sorted by relevance.
   *
   * @param userId - The UUID of the logged-in user.
   * @param limit - The maximum number of jobs to return (default: 5).
   * @returns A list of jobs, optionally with a `relevanceScore` field.
   */
  async getPersonalizedFeed(userId: string, limit: number = 5) {
    // 1. Check GDPR consent
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gdprConsent: true },
    });

    if (!user?.gdprConsent) {
      // GDPR opt-out: return generic (non-personalized) jobs
      return this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { company: true, category: true },
      });
    }

    // 2. Get user's search history from the last 30 days
    const history = await this.prisma.searchHistory.findMany({
      where: {
        userId,
        searchedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
      },
    });

    // 3. Extract meaningful keywords
    const keywords = this.extractKeywords(history.map(h => h.searchTerm));

    // 4. Fallback to generic if no keywords found
    if (keywords.length === 0) {
      return this.prisma.job.findMany({
        where: { status: 'PUBLISHED' },
        orderBy: { createdAt: 'desc' },
        take: limit,
        include: { company: true, category: true },
      });
    }

    // 5. Fetch all published jobs
    const jobs = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      include: { company: true, category: true },
    });

    // 6. Score and return top results
    return jobs
      .map(job => {
        const text = (
          job.title +
          ' ' +
          job.description +
          ' ' +
          (job.tags?.join(' ') || '')
        ).toLowerCase();
        const score = keywords.filter(kw => text.includes(kw)).length;
        const relevanceScore = Math.min(100, Math.round((score / keywords.length) * 100));
        return { ...job, relevanceScore };
      })
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .slice(0, limit);
  }

  /**
   * Cleans and extracts unique, meaningful keywords from an array of search terms.
   * 
   * Removes common stop-words (e.g., "the", "for", "in") and filters out tokens
   * shorter than 3 characters to keep only relevant search terms.
   *
   * @param terms - An array of raw search strings from the user.
   * @returns A de-duplicated array of cleaned keywords.
   */
  private extractKeywords(terms: string[]): string[] {
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'for', 'on', 'at', 'to',
      'in', 'with', 'without', 'of', 'for', 'by', 'from', 'up', 'via',
    ]);
    const allWords = terms.join(' ').toLowerCase().split(/\s+/);
    const unique = [...new Set(allWords)];
    return unique.filter(word => word.length > 2 && !stopWords.has(word));
  }
        }
