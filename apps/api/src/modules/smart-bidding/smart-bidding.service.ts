import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { PredictBidResponseDto } from './dto/predict-bid-response.dto';

interface JobComplexityResult {
  complexityFactor: number;
  estimatedTimelineDays: number;
  explanationEn: string;
  explanationAm: string;
  aiModelUsed: string;
  isAiProcessed: boolean;
}

/** TTL for a successfully AI-processed complexity result (24 hours) */
const COMPLEXITY_AI_TTL_SECONDS = 86400;

/** Short TTL for a heuristic fallback result — allows recovery once OpenAI is healthy (5 minutes) */
const COMPLEXITY_FALLBACK_TTL_SECONDS = 300;

/** TTL for the in-flight lock that prevents a cache stampede on OpenAI (30 seconds) */
const COMPLEXITY_LOCK_TTL_SECONDS = 30;

/** How long to poll the cache while waiting for an in-flight OpenAI request to complete (ms) */
const LOCK_POLL_INTERVAL_MS = 500;
const LOCK_POLL_MAX_ATTEMPTS = 6; // 6 × 500ms = 3 seconds max wait

@Injectable()
export class SmartBiddingService {
  private openai: OpenAI | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Evaluates job complexity using OpenAI and caches the result strictly per Job ID.
   * Shared across all freelancers checking predictions for the same job.
   *
   * Fix 3 — Cache Stampede Prevention:
   *   Uses a Redis NX lock so only ONE process calls OpenAI for a given job.
   *   Concurrent callers poll the cache briefly and fall back to heuristics if
   *   the result never arrives within the polling window.
   *
   * Fix 4 — Fallback TTL:
   *   AI results are cached for 24 h; heuristic fallbacks are cached for only
   *   5 minutes so the system recovers automatically once OpenAI is healthy.
   */
  private async getJobComplexity(job: any): Promise<JobComplexityResult> {
    const complexityCacheKey = `smart-bidding:complexity:job:${job.id}`;
    const lockKey = `smart-bidding:complexity:lock:${job.id}`;

    // 1. Try reading cached job complexity first (happy path — no locking needed)
    try {
      const cachedComplexity = await this.redis.get(complexityCacheKey);
      if (cachedComplexity) {
        return JSON.parse(cachedComplexity) as JobComplexityResult;
      }
    } catch (err) {
      console.error('Failed to read job complexity from Redis:', (err as Error).message);
    }

    // Default fallback values used when OpenAI is unavailable or when waiting
    // for another in-flight request to complete.
    const buildFallback = (): JobComplexityResult => ({
      complexityFactor: 1.0,
      estimatedTimelineDays: job.deadlineDays,
      explanationEn:
        'Calculation based on platform historical category averages and freelance job parameters.',
      explanationAm: 'ስሌቱ የተከናወነው በታሪካዊ የዘርፍ አማካዮች እና በፍሪላንስ ስራው መለኪያዎች ላይ በመመስረት ነው።',
      aiModelUsed: 'none (fallback heuristic)',
      isAiProcessed: false,
    });

    // 2. Fix 3 — Attempt to acquire the in-flight lock (SET NX EX).
    //    Only the process that wins the lock will call OpenAI.
    let lockAcquired = false;
    try {
      const lockResult = await this.redis.set(
        lockKey,
        '1',
        'EX',
        COMPLEXITY_LOCK_TTL_SECONDS,
        'NX',
      );
      lockAcquired = lockResult === 'OK';
    } catch (err) {
      console.error('Failed to acquire OpenAI lock from Redis:', (err as Error).message);
      // If Redis itself is down, proceed without the lock to keep the service alive.
      lockAcquired = true;
    }

    if (!lockAcquired) {
      // Another process is already calling OpenAI. Poll the cache key for up to
      // LOCK_POLL_MAX_ATTEMPTS × LOCK_POLL_INTERVAL_MS milliseconds, then give up
      // and return a heuristic fallback for this request only.
      for (let i = 0; i < LOCK_POLL_MAX_ATTEMPTS; i++) {
        await new Promise((resolve) => setTimeout(resolve, LOCK_POLL_INTERVAL_MS));
        try {
          const polled = await this.redis.get(complexityCacheKey);
          if (polled) {
            return JSON.parse(polled) as JobComplexityResult;
          }
        } catch {
          // Redis error during poll — stop polling and fall through to heuristic.
          break;
        }
      }
      // Polling timed out — return a non-cached heuristic so the caller still
      // gets a response. We deliberately do NOT cache this to avoid overwriting
      // the in-flight result.
      return buildFallback();
    }

    // 3. We hold the lock — call OpenAI if an API key is configured.
    let result: JobComplexityResult = buildFallback();

    if (this.openai) {
      try {
        const systemPrompt = `You are an expert project estimator for a freelance software and digital services platform.
Given a freelance job description, your task is to evaluate project complexity and output a JSON object containing:
1. "complexityFactor": a float between 0.8 (simple, low effort) and 1.3 (highly complex, enterprise level).
2. "estimatedTimelineDays": suggested days to complete.
3. "explanationEn": brief, professional English explanation of the complexity.
4. "explanationAm": brief, professional Amharic translation of the explanation.

Your response must be a single valid JSON object and nothing else. No markdown wrappers, no prefix.
Example response:
{
  "complexityFactor": 1.15,
  "estimatedTimelineDays": 14,
  "explanationEn": "The project requires custom API integration and responsive design, suggesting moderate complexity.",
  "explanationAm": "ፕሮጀክቱ የኤፒአይ ማገናኛዎችን እና ምላሽ ሰጪ ንድፍን ስለሚጠይቅ መካከለኛ ውስብስብነት እንዳለው ያሳያል።"
}`;

        const userPrompt = `Job Title: ${job.title}
Job Description: ${job.description}
Budget Bounds: ${job.budgetMin} to ${job.budgetMax} ${job.currency}
Required Skills: ${job.skills?.join(', ') || ''}
Client Specified Deadline: ${job.deadlineDays} days`;

        const response = await this.openai.chat.completions.create({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          temperature: 0.2,
        });

        const content = response.choices[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          const aiResult: JobComplexityResult = {
            complexityFactor:
              typeof parsed.complexityFactor === 'number'
                ? parsed.complexityFactor
                : result.complexityFactor,
            estimatedTimelineDays:
              typeof parsed.estimatedTimelineDays === 'number'
                ? parsed.estimatedTimelineDays
                : result.estimatedTimelineDays,
            explanationEn: parsed.explanationEn || result.explanationEn,
            explanationAm: parsed.explanationAm || result.explanationAm,
            aiModelUsed: 'gpt-4o-mini',
            isAiProcessed: true,
          };
          result = aiResult;
        }
      } catch (err) {
        console.error('OpenAI prediction parsing failed, falling back:', (err as Error).message);
        // result remains the heuristic fallback built above
      }
    }

    // 4. Fix 4 — Cache with TTL that reflects result quality:
    //    - AI result  → 24 h (COMPLEXITY_AI_TTL_SECONDS)
    //    - Fallback   → 5 min (COMPLEXITY_FALLBACK_TTL_SECONDS) so the system
    //      automatically recovers on the next request once OpenAI is healthy.
    const cacheTtl = result.isAiProcessed
      ? COMPLEXITY_AI_TTL_SECONDS
      : COMPLEXITY_FALLBACK_TTL_SECONDS;

    try {
      await this.redis.set(complexityCacheKey, JSON.stringify(result), 'EX', cacheTtl);
    } catch (err) {
      console.error('Failed to write job complexity to Redis:', (err as Error).message);
    }

    // Release the lock early so other waiters can read from cache immediately.
    try {
      await this.redis.del(lockKey);
    } catch {
      // Non-fatal — lock will expire on its own via the TTL.
    }

    return result;
  }

  async predictBid(jobId: string, freelancerId?: string): Promise<PredictBidResponseDto> {
    const cacheKey = `smart-bidding:job:${jobId}:freelancer:${freelancerId || 'generic'}`;

    // 1. Check Full Prediction Redis Cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PredictBidResponseDto;
        parsed.cached = true;
        return parsed;
      }
    } catch (err) {
      console.error('Failed to read from Redis cache:', (err as Error).message);
    }

    // 2. Fetch Job Details
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: jobId },
      include: { category: true },
    });

    if (!job) {
      throw new NotFoundException(`Freelance job with ID ${jobId} not found`);
    }

    // 3. Compute Market baseline filtered strictly by category AND currency.
    //
    //    Fix 2 — Data Aggregation Mismatch:
    //    Contract has its own native `currency` field which can diverge from the
    //    parent job's currency when terms are negotiated.  We now filter directly
    //    on `contract.currency` to ensure we only average contracts in the same
    //    currency, preventing meaningless cross-currency averages (e.g. USD + ETB).
    let marketBaseline = (job.budgetMin + job.budgetMax) / 2;
    let hasHistoricalData = false;

    const completedContracts = await this.prisma.contract.findMany({
      where: {
        freelanceJob: {
          categoryId: job.categoryId,
        },
        currency: job.currency, // Filter on Contract's own currency field
        status: 'COMPLETED',
      },
      take: 10,
      orderBy: { completedAt: 'desc' },
    });

    if (completedContracts.length > 0) {
      const sum = completedContracts.reduce((acc, curr) => acc + curr.agreedAmount, 0);
      marketBaseline = sum / completedContracts.length;
      hasHistoricalData = true;
    } else {
      // Bids don't have their own currency field so filtering via the parent job
      // relation is still the correct approach here.
      const acceptedBids = await this.prisma.bid.findMany({
        where: {
          freelanceJob: {
            categoryId: job.categoryId,
            currency: job.currency,
          },
          status: 'ACCEPTED',
        },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
      if (acceptedBids.length > 0) {
        const sum = acceptedBids.reduce((acc, curr) => acc + curr.amount, 0);
        marketBaseline = sum / acceptedBids.length;
        hasHistoricalData = true;
      }
    }

    // 4. Freelancer Specific Calculations
    let seniorityMultiplier = 1.0;
    let skillMatchMultiplier = 1.0;
    let hasFreelancerSkills = false;

    if (freelancerId) {
      const freelancer = await this.prisma.user.findUnique({
        where: { id: freelancerId },
      });

      if (freelancer) {
        const completedCount = await this.prisma.contract.count({
          where: { freelancerId, status: 'COMPLETED' },
        });

        if (completedCount >= 8) {
          seniorityMultiplier = 1.25;
        } else if (completedCount >= 3) {
          seniorityMultiplier = 1.05;
        } else {
          seniorityMultiplier = 0.85;
        }

        if (
          freelancer.skills &&
          freelancer.skills.length > 0 &&
          job.skills &&
          job.skills.length > 0
        ) {
          hasFreelancerSkills = true;
          const matchingSkills = job.skills.filter((s) =>
            freelancer.skills.some((fs) => fs.toLowerCase() === s.toLowerCase()),
          );
          const ratio = matchingSkills.length / job.skills.length;
          skillMatchMultiplier = 0.9 + ratio * 0.25;
        }
      }
    }

    // 5. Fetch Cached / AI-Generated Job Complexity (stampede-safe)
    const {
      complexityFactor,
      estimatedTimelineDays,
      explanationEn,
      explanationAm,
      aiModelUsed,
      isAiProcessed,
    } = await this.getJobComplexity(job);

    // 6. Final Calculations
    const recommendedBidAmount = Math.round(
      marketBaseline * complexityFactor * seniorityMultiplier * skillMatchMultiplier,
    );

    const minSuggestedBid = Math.round(recommendedBidAmount * 0.85);
    const maxSuggestedBid = Math.round(recommendedBidAmount * 1.15);

    let confidenceScore = 50;
    if (hasHistoricalData) confidenceScore += 20;
    if (hasFreelancerSkills) confidenceScore += 15;
    if (isAiProcessed) confidenceScore += 15;
    confidenceScore = Math.min(98, confidenceScore);

    const predictionResult: PredictBidResponseDto = {
      recommendedBidAmount,
      minSuggestedBid,
      maxSuggestedBid,
      currency: job.currency,
      confidenceScore,
      estimatedTimelineDays,
      breakdown: {
        marketBaseline: Math.round(marketBaseline),
        experienceAdjustment: Number((seniorityMultiplier - 1).toFixed(2)),
        skillMatchAdjustment: Number((skillMatchMultiplier - 1).toFixed(2)),
        complexityAdjustment: Number((complexityFactor - 1).toFixed(2)),
        explanationEn,
        explanationAm,
      },
      aiModelUsed,
      cached: false,
    };

    // 7. Store Full Prediction in Cache for 1 hour (3600s)
    const predictionCacheTtl = isAiProcessed ? 3600 : COMPLEXITY_FALLBACK_TTL_SECONDS;

    try {
      await this.redis.set(cacheKey, JSON.stringify(predictionResult), 'EX', predictionCacheTtl);
    } catch (err) {
      console.error('Failed to write to Redis cache:', (err as Error).message);
    }

    return predictionResult;
  }
}
