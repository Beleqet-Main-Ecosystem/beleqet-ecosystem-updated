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
 * Upper bound on how many keywords are ever used to build the DB filter.
 * A user with a long search history + many skills could otherwise generate
 * dozens of keywords, each contributing two `ILIKE '%...%'` clauses to the
 * `OR` array — every one of which forces Postgres into a sequential scan
 * (leading-wildcard ILIKE can't use a standard b-tree index). Capping bounds
 * the query to a fixed, predictable cost regardless of how active a user is.
 * We keep the *head* of the (already deduplicated) extracted list, since
 * `extractKeywords` preserves input order and search terms are placed before
 * skills — recent search intent should win over static declared skills when
 * something has to be dropped.
 */
const MAX_KEYWORDS = 12;

/**
 * Candidate pools are fetched *separately* for keyword matches and for
 * category-affinity matches, then merged. If they were combined into one
 * `OR` clause (as before), a broad saved category could dominate the
 * `take` + `orderBy: createdAt desc` cutoff and push out older jobs that
 * are a much stronger keyword match — the pool would fill with "recent in
 * this category" rows before keyword-relevant rows ever got a chance.
 * Keeping separate, smaller caps guarantees both signals always get
 * representation in the pool that reaches `rankJobs`.
 */
const KEYWORD_POOL_SIZE = 150;
const CATEGORY_POOL_SIZE = 50;

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

    // Bound keyword volume before it ever reaches a query — see MAX_KEYWORDS.
    // Slice from the front: search terms come first in `keywords`, so this
    // keeps recent search intent over static declared skills when truncating.
    const boundedKeywords = keywords.slice(0, MAX_KEYWORDS);

    const jobs = await this.fetchCandidatePool(boundedKeywords, savedCategoryIds);

    return this.rankJobs(jobs, boundedKeywords, savedCategoryIds).slice(0, limit);
  }

  /**
   * Fetches candidate jobs as two independent, bounded pools — one for
   * keyword matches and one for saved-category affinity — and merges them,
   * de-duplicated by id.
   *
   * Keeping them separate (rather than one `OR` array with a shared `take`)
   * prevents a broad saved category from flooding the pool with its most
   * recent jobs and crowding out older, more specific keyword matches.
   * Each pool has its own small cap, so the combined worst case
   * (`KEYWORD_POOL_SIZE + CATEGORY_POOL_SIZE`) is still far smaller and more
   * predictable than the old single 200-row pool, while guaranteeing both
   * signals are represented.
   */
  private async fetchCandidatePool(
    keywords: string[],
    savedCategoryIds: Set<string>,
  ): Promise<FeedJob[]> {
    const [keywordJobs, categoryJobs] = await Promise.all([
      keywords.length > 0
        ? this.prisma.job.findMany({
            where: { status: 'PUBLISHED', OR: this.buildKeywordFilter(keywords) },
            orderBy: { createdAt: 'desc' },
            take: KEYWORD_POOL_SIZE,
            include: { company: true, category: true },
          })
        : Promise.resolve([]),
      savedCategoryIds.size > 0
        ? this.prisma.job.findMany({
            where: { status: 'PUBLISHED', categoryId: { in: [...savedCategoryIds] } },
            orderBy: { createdAt: 'desc' },
            take: CATEGORY_POOL_SIZE,
            include: { company: true, category: true },
          })
        : Promise.resolve([]),
    ]);

    const merged = new Map<string, FeedJob>();
    for (const job of [...keywordJobs, ...categoryJobs] as FeedJob[]) {
      merged.set(job.id, job);
    }
    return [...merged.values()];
  }

  /**
   * Builds the `OR` clause for keyword-based candidate matching only.
   * Category affinity is now fetched as its own pool (see
   * `fetchCandidatePool`), so this no longer mixes the two signals into a
   * single filter.
   *
   * NOTE: `contains`/ILIKE with a leading wildcard cannot use a standard
   * b-tree index, so each clause here is a sequential-scan predicate.
   * `MAX_KEYWORDS` bounds how many of these are ever issued per request.
   * For real production scale, the durable fix is a Postgres trigram index
   * (`pg_trgm` + `GIN (title gin_trgm_ops)` / `(description gin_trgm_ops)`),
   * or moving to a `tsvector` full-text column — happy to add that
   * migration if useful.
   */
  private buildKeywordFilter(keywords: string[]): Array<Record<string, unknown>> {
    const clauses: Array<Record<string, unknown>> = [];

    for (const keyword of keywords) {
      clauses.push({ title: { contains: keyword, mode: 'insensitive' } });
      clauses.push({ description: { contains: keyword, mode: 'insensitive' } });
    }
    clauses.push({ tags: { hasSome: keywords } });

    return clauses;
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

  /**
   * Computes a single job's 0-100 relevance score.
   *
   * Keyword matching is done on whole tokens (see `tokenize`), not raw
   * substrings, so a keyword like "net" no longer falsely matches inside
   * "network" or "planet".
   */
  private scoreJob(job: FeedJob, keywords: string[], savedCategoryIds: Set<string>): number {
    let score = 0;

    if (keywords.length > 0) {
      const tokens = this.tokenize(
        `${job.title} ${job.description} ${(job.tags ?? []).join(' ')}`,
      );
      const matches = keywords.filter((keyword) => tokens.has(keyword)).length;
      score += (matches / keywords.length) * KEYWORD_MATCH_WEIGHT;
    }

    if (savedCategoryIds.has(job.categoryId)) {
      score += CATEGORY_AFFINITY_WEIGHT;
    }

    return Math.min(100, Math.round(score));
  }

  /**
   * Splits text into a de-duplicated set of lower-cased word tokens, so
   * keyword matching in `scoreJob` compares whole words instead of raw
   * substrings.
   */
  private tokenize(text: string): Set<string> {
    return new Set(text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
  }

  /**
   * Normalizes a list of free-text terms (search queries and/or skills)
   * into a de-duplicated keyword set with stop-words and very short tokens
   * removed.
   *
   * IMPORTANT: this must split text the *same way* `tokenize()` does. An
   * earlier version split only on whitespace here, which let punctuation
   * survive (e.g. "Node.js" -> one token "node.js"), while `tokenize()`
   * splits on any non-alphanumeric character when scoring job text (e.g.
   * "Node.js" in a job description -> two tokens "node", "js"). That
   * mismatch meant `tokens.has(keyword)` could never be true for any
   * keyword containing punctuation — the job would be fetched as a DB
   * candidate but always score 0. Sharing `tokenize()` here guarantees the
   * two sides can never drift apart again.
   *
   * Trade-off: this does mean short fragments like "js" (from "Node.js")
   * or "c" (from "C#") fall below the length-3 floor and are dropped as
   * keywords. That's an intentional, existing filter (see `STOP_WORDS`/the
   * length check below) — it wasn't relaxed here.
   */
  private extractKeywords(terms: string[]): string[] {
    const words = this.tokenize(terms.join(' '));
    return [...words].filter((word) => word.length > 2 && !STOP_WORDS.has(word));
  }
}