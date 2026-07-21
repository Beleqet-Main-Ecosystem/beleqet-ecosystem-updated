import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';
import Redis from 'ioredis';
import OpenAI from 'openai';
import { PredictBidResponseDto } from './dto/predict-bid-response.dto';

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

  async predictBid(jobId: string, freelancerId?: string): Promise<PredictBidResponseDto> {
    const cacheKey = `smart-bidding:job:${jobId}:freelancer:${freelancerId || 'generic'}`;
    
    // 1. Check Redis Cache
    try {
      const cached = await this.redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as PredictBidResponseDto;
        parsed.cached = true;
        return parsed;
      }
    } catch (err) {
      console.error('Failed to read from Redis cache:', err.message);
    }

    // 2. Fetch Job Details
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: jobId },
      include: { category: true },
    });

    if (!job) {
      throw new NotFoundException(`Freelance job with ID ${jobId} not found`);
    }

    // 3. Compute Market baseline from historical data
    let marketBaseline = (job.budgetMin + job.budgetMax) / 2;
    let hasHistoricalData = false;

    // Get historical accepted bids or completed contracts in the same category
    const completedContracts = await this.prisma.contract.findMany({
      where: {
        freelanceJob: {
          categoryId: job.categoryId,
        },
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
      // Look at any accepted bids in same category
      const acceptedBids = await this.prisma.bid.findMany({
        where: {
          freelanceJob: {
            categoryId: job.categoryId,
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
        // Experience Multiplier based on historical completed contracts
        const completedCount = await this.prisma.contract.count({
          where: { freelancerId, status: 'COMPLETED' },
        });

        if (completedCount >= 8) {
          seniorityMultiplier = 1.25; // Expert
        } else if (completedCount >= 3) {
          seniorityMultiplier = 1.05; // Intermediate / Mid
        } else {
          seniorityMultiplier = 0.85; // Entry / Junior
        }

        // Skills match multiplier
        if (freelancer.skills && freelancer.skills.length > 0 && job.skills && job.skills.length > 0) {
          hasFreelancerSkills = true;
          const matchingSkills = job.skills.filter(s =>
            freelancer.skills.some(fs => fs.toLowerCase() === s.toLowerCase()),
          );
          const ratio = matchingSkills.length / job.skills.length;
          // Scale multiplier between 0.9 (no matching skills) and 1.15 (100% matching skills)
          skillMatchMultiplier = 0.9 + ratio * 0.25;
        }
      }
    }

    // 5. LLM-Based Complexity & Scope Parsing with fallback
    let complexityFactor = 1.0;
    let estimatedTimelineDays = job.deadlineDays;
    let explanationEn = 'Calculation based on platform historical category averages and freelance job parameters.';
    let explanationAm = 'ስሌቱ የተከናወነው በታሪካዊ የዘርፍ አማካዮች እና በፍሪላንስ ስራው መለኪያዎች ላይ በመመስረት ነው።';
    let aiModelUsed = 'none (fallback heuristic)';
    let isAiProcessed = false;

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
Required Skills: ${job.skills.join(', ')}
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
          if (typeof parsed.complexityFactor === 'number') {
            complexityFactor = parsed.complexityFactor;
          }
          if (typeof parsed.estimatedTimelineDays === 'number') {
            estimatedTimelineDays = parsed.estimatedTimelineDays;
          }
          if (parsed.explanationEn) {
            explanationEn = parsed.explanationEn;
          }
          if (parsed.explanationAm) {
            explanationAm = parsed.explanationAm;
          }
          aiModelUsed = 'gpt-4o-mini';
          isAiProcessed = true;
        }
      } catch (err) {
        console.error('OpenAI prediction parsing failed, falling back:', err.message);
      }
    }

    // 6. Final Calculations
    const recommendedBidAmount = Math.round(
      marketBaseline * complexityFactor * seniorityMultiplier * skillMatchMultiplier,
    );

    // Calculate dynamic range
    const minSuggestedBid = Math.round(recommendedBidAmount * 0.85);
    const maxSuggestedBid = Math.round(recommendedBidAmount * 1.15);

    // Confidence Calculation
    let confidenceScore = 50; // base score
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

    // 7. Store in Cache for 1 hour (3600 seconds)
    try {
      await this.redis.set(cacheKey, JSON.stringify(predictionResult), 'EX', 3600);
    } catch (err) {
      console.error('Failed to write to Redis cache:', err.message);
    }

    return predictionResult;
  }
}
