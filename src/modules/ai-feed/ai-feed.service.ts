import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Minimal published-job shape this service needs in order to score and
 * display a recommendation. Declared explicitly (instead of importing the
 * generated `Prisma.JobGetPayload<...>` type) so this module compiles the
 * same way whether or not `prisma generate` has been run in the current
 * environment — the same pattern already used in `jobs.service.ts`.
 */
interface FeedJob {
  id: string;
  title: string;
  description: string;
  tags: string[];
  categoryId: string;
  salaryMin: number | null;
  salaryMax: number | null;
  /** ISO 4217-style currency code (e.g. "ETB", "USD"). Kept per-job rather
   *  than assumed globally, so the feed supports multi-currency listings. */
  currency: string;
  createdAt: Date;
  company: { id: string; name: string } | null;
  category: { id: string; slug: string; label: string } | null;
}

/**
 * A `FeedJob` enriched with a computed relevance score for the requesting
 * user. `relevanceScore` is always in the 0-100 range, where 100 means the
 * job matched every known signal for that user.
 */
export type PersonalizedJob = FeedJob & { relevanceScore: number };

/** Search-history rows are only considered "recent" within this window. */
const SEARCH_HISTORY_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

/** Common English stop-words filtered out of extracted keyword sets. */
const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'for', 'on', 'at', 'to', 'in',
  'with', 'without', 'of', 'by', 'is', 'are', 'job', 'jobs',
]);

/**
 * Relative weight given to keyword matches (search history + skills)
 * versus the category-affinity bonus (derived from saved jobs) when
 * computing a job's final relevance score. Both are expressed as a
 * percentage of the total 100-point score.
 */
const KEYWORD_MATCH_WEIGHT = 70;
const CATEGORY_AFFINITY_WEIGHT = 30;

/**
 * `AiFeedService` implements the "AI Personal Feed" recommendation logic.
 *
 * It builds a personalized ranking of published jobs for a given user by
 * combining three first-party signals already present in the database:
 *   1. Recent search terms (`SearchHistory`)
 *   2. Declared skills (`User.skills`)
 *   3. Category affinity inferred from previously saved jobs (`SavedJob`)
 *
 * GDPR: personalization is only ever computed when the user has
 * `gdprConsent = true`. When consent is absent, the service falls back to
 * a generic, non-personalized "latest jobs" feed and never reads the
 * user's search history, skills, or saved jobs.
 */
@Injectable()
export class AiFeedService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Computes the personalized job feed for a user.
   *
   * The result is always derived from the current state of the database
   * (no caching layer), so every call reflects the latest searches, saved
   * jobs, and job postings — satisfying the requirement that the feed keep
   * itself up to date as new data comes in.
   *
   * @param userId - id of the authenticated user the feed is generated for
   * @param limit - maximum number of jobs to return (defaults to 5)
   * @returns ranked jobs, most relevant first
   */
  async getPersonalizedFeed(userId: string, limit = 5): Promise<PersonalizedJob[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { gdprConsent: true, skills: true },
    });

    if (!user?.gdprConsent) {
      return this.getGenericFeed(limit);
    }

    const [searchTerms, savedCategoryIds] = await Promise.all([
      this.getRecentSearchTerms(userId),
      this.getSavedJobCategoryIds(userId),
    ]);

    const keywords = this.extractKeywords([...searchTerms, ...(user.skills ?? [])]);

    // No personalization signal at all yet (new user) -> generic feed.
    if (keywords.length === 0 && savedCategoryIds.size === 0) {
      return this.getGenericFeed(limit);
    }

    const jobs: FeedJob[] = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      include: { company: true, category: true },
    });

    return this.rankJobs(jobs, keywords, savedCategoryIds).slice(0, limit);
  }

  /**
   * Fetches the user's search terms from the last 30 days.
   * Returns an empty array if the user has no recent search activity.
   */
  private async getRecentSearchTerms(userId: string): Promise<string[]> {
    const history: Array<{ searchTerm: string }> = await this.prisma.searchHistory.findMany({
      where: {
        userId,
        searchedAt: { gte: new Date(Date.now() - SEARCH_HISTORY_WINDOW_MS) },
      },
      select: { searchTerm: true },
    });
    return history.map((entry: { searchTerm: string }) => entry.searchTerm);
  }

  /**
   * Fetches the set of job-category ids the user has previously saved a
   * job from. Used as a lightweight "the user likes this category" signal,
   * standing in for explicit "viewed jobs" tracking.
   */
  private async getSavedJobCategoryIds(userId: string): Promise<Set<string>> {
    const saved: Array<{ job: { categoryId: string } }> = await this.prisma.savedJob.findMany({
      where: { userId },
      select: { job: { select: { categoryId: true } } },
    });
    return new Set(saved.map((entry: { job: { categoryId: string } }) => entry.job.categoryId));
  }

  /**
   * Returns the most recent published jobs with no personalization applied.
   * Used both as the GDPR-safe fallback and as the cold-start fallback for
   * users with no usable signal yet. Every job still gets a `relevanceScore`
   * of 0 so the response shape is consistent for the frontend.
   */
  private async getGenericFeed(limit: number): Promise<PersonalizedJob[]> {
    const jobs: FeedJob[] = await this.prisma.job.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: { company: true, category: true },
    });
    return jobs.map((job: FeedJob) => ({ ...job, relevanceScore: 0 }));
  }

  /**
   * Scores and sorts jobs by relevance to the given keyword set and
   * saved-category affinity.
   *
   * Score composition (0-100):
   *   - up to `KEYWORD_MATCH_WEIGHT` points for the fraction of keywords
   *     found in the job's title, description, or tags
   *   - a flat `CATEGORY_AFFINITY_WEIGHT` bonus if the job's category
   *     matches one the user has previously saved a job from
   */
  private rankJobs(
    jobs: FeedJob[],
    keywords: string[],
    savedCategoryIds: Set<string>,
  ): PersonalizedJob[] {
    return jobs
      .map((job) => ({ ...job, relevanceScore: this.scoreJob(job, keywords, savedCategoryIds) }))
      .sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  /** Computes a single job's 0-100 relevance score. */
  private scoreJob(job: FeedJob, keywords: string[], savedCategoryIds: Set<string>): number {
    let score = 0;

    if (keywords.length > 0) {
      const text = `${job.title} ${job.description} ${job.tags.join(' ')}`.toLowerCase();
      const matches = keywords.filter((keyword) => text.includes(keyword)).length;
      score += (matches / keywords.length) * KEYWORD_MATCH_WEIGHT;
    }

    if (savedCategoryIds.has(job.categoryId)) {
      score += CATEGORY_AFFINITY_WEIGHT;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Normalizes a list of free-text terms (search queries and/or skills)
   * into a de-duplicated, lower-cased keyword set with stop-words and
   * very short tokens removed.
   */
  private extractKeywords(terms: string[]): string[] {
    const words = terms.join(' ').toLowerCase().split(/\s+/);
    return [...new Set(words)].filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  }
}
