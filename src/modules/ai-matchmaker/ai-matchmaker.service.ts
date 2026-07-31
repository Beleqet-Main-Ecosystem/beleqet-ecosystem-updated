import { Injectable, Logger, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { QUEUE_NAMES, AI_MATCHMAKER_JOBS } from '../queues/queues.constants';
import { QueryMatchmakerDto, MatchSortBy } from './dto/query-matchmaker.dto';
import {
  MatchScoreResponse,
  MatchAnalyticsResponse,
  MatchBreakdownMetadata,
} from './dto/match-response.dto';

/** Seniority levels mapped to integer rank indices for experience distance calculation */
const SENIORITY_MAP: Record<string, number> = {
  JUNIOR: 1,
  MID: 2,
  SENIOR: 3,
  LEAD: 4,
  EXECUTIVE: 5,
};

/** Current scoring algorithm version — increment when weighting formula changes */
const ALGORITHM_VERSION = 'v1';

/** Common stop words filtered out during skill tokenization */
const STOP_WORDS = new Set([
  'the',
  'and',
  'or',
  'a',
  'an',
  'in',
  'on',
  'at',
  'to',
  'for',
  'with',
  'by',
  'about',
  'as',
  'is',
  'are',
  'was',
  'were',
]);

/**
 * AiMatchmakerService — Core Enterprise Matching Engine
 *
 * Computes multi-vector compatibility metrics between candidates and jobs,
 * enforces GDPR privacy policies, and manages database persistence and caching.
 */
@Injectable()
export class AiMatchmakerService {
  private readonly logger = new Logger(AiMatchmakerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(QUEUE_NAMES.AI_MATCHMAKER) private readonly matchmakerQueue: Queue,
  ) {}

  /**
   * Enqueues a batch matching calculation job for a specific job listing.
   * Prevents HTTP thread blocking by offloading heavy computation to BullMQ.
   */
  async enqueueJobMatching(jobId: string): Promise<{ queued: boolean; jobId: string }> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      throw new NotFoundException(`Job posting with ID "${jobId}" was not found`);
    }

    await this.matchmakerQueue.add(AI_MATCHMAKER_JOBS.CALCULATE_JOB_MATCHES, { jobId });
    this.logger.log(`Enqueued batch matching calculation for job ID ${jobId}`);

    return { queued: true, jobId };
  }

  /**
   * Calculates and persists compatibility match score between a candidate and a job.
   * Respects candidate GDPR consent.
   */
  async calculateAndPersistMatch(candidateId: string, jobId: string): Promise<MatchScoreResponse> {
    const [candidate, job] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: candidateId } }),
      this.prisma.job.findUnique({
        where: { id: jobId },
        include: { company: { select: { name: true } } },
      }),
    ]);

    if (!candidate) {
      throw new NotFoundException(`Candidate user with ID "${candidateId}" was not found`);
    }
    if (!job) {
      throw new NotFoundException(`Job posting with ID "${jobId}" was not found`);
    }

    // GDPR Guard Enforcement: Skip automated profiling if user opted out
    if (candidate.gdprConsent === false) {
      this.logger.warn(
        `Skipping match calculation for candidate ${candidateId} due to gdprConsent = false`,
      );
      throw new ForbiddenException(
        `Candidate has not granted GDPR consent for automated match profiling.`,
      );
    }

    const matchData = this.computePairwiseScores(candidate, job);

    const savedRecord = await this.prisma.matchScore.upsert({
      where: {
        candidateId_jobId: { candidateId, jobId },
      },
      update: {
        skillScore: matchData.skillScore,
        experienceScore: matchData.experienceScore,
        educationScore: matchData.educationScore,
        locationScore: matchData.locationScore,
        totalScore: matchData.totalScore,
        metadata: matchData.metadata as unknown as object,
        algorithmVersion: ALGORITHM_VERSION,
      },
      create: {
        candidateId,
        jobId,
        skillScore: matchData.skillScore,
        experienceScore: matchData.experienceScore,
        educationScore: matchData.educationScore,
        locationScore: matchData.locationScore,
        totalScore: matchData.totalScore,
        metadata: matchData.metadata as unknown as object,
        algorithmVersion: ALGORITHM_VERSION,
      },
      include: {
        candidate: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            headline: true,
            skills: true,
            location: true,
          },
        },
        job: {
          select: {
            id: true,
            title: true,
            location: true,
            tags: true,
            experienceLevel: true,
            company: { select: { name: true } },
          },
        },
      },
    });

    return savedRecord as unknown as MatchScoreResponse;
  }

  /**
   * Batch recalculates matches for all eligible candidates against a job.
   * Called asynchronously by BullMQ worker processor.
   */
  async batchCalculateForJob(jobId: string): Promise<number> {
    const job = await this.prisma.job.findUnique({ where: { id: jobId } });
    if (!job) {
      this.logger.error(`Batch matching failed: Job ${jobId} not found.`);
      return 0;
    }

    // Pre-filtering candidate pool: Only users with gdprConsent = true
    const eligibleCandidates = await this.prisma.user.findMany({
      where: {
        gdprConsent: true,
        role: { in: ['JOB_SEEKER', 'FREELANCER'] },
      },
      take: 200, // Safe batch limit for fast execution
    });

    let processedCount = 0;
    for (const candidate of eligibleCandidates) {
      try {
        const scores = this.computePairwiseScores(candidate, job);
        await this.prisma.matchScore.upsert({
          where: { candidateId_jobId: { candidateId: candidate.id, jobId } },
          update: {
            skillScore: scores.skillScore,
            experienceScore: scores.experienceScore,
            educationScore: scores.educationScore,
            locationScore: scores.locationScore,
            totalScore: scores.totalScore,
            metadata: scores.metadata as unknown as object,
            algorithmVersion: ALGORITHM_VERSION,
          },
          create: {
            candidateId: candidate.id,
            jobId,
            skillScore: scores.skillScore,
            experienceScore: scores.experienceScore,
            educationScore: scores.educationScore,
            locationScore: scores.locationScore,
            totalScore: scores.totalScore,
            metadata: scores.metadata as unknown as object,
            algorithmVersion: ALGORITHM_VERSION,
          },
        });
        processedCount++;
      } catch (err) {
        this.logger.error(
          `Error scoring candidate ${candidate.id} for job ${jobId}: ${(err as Error).message}`,
        );
      }
    }

    this.logger.log(
      `Completed batch calculation for job ${jobId}. Processed ${processedCount} candidates.`,
    );
    return processedCount;
  }

  /**
   * Fast indexed retrieval of ranked candidate matches for a given job.
   */
  async getRankedCandidatesForJob(
    jobId: string,
    query: QueryMatchmakerDto,
  ): Promise<{ data: MatchScoreResponse[]; total: number; page: number; limit: number }> {
    const { minScore = 0, page = 1, limit = 20, sortBy = MatchSortBy.TOTAL_SCORE } = query;

    const whereClause = {
      jobId,
      totalScore: { gte: Number(minScore) },
    };

    const [total, records] = await Promise.all([
      this.prisma.matchScore.count({ where: whereClause }),
      this.prisma.matchScore.findMany({
        where: whereClause,
        orderBy: { [sortBy]: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          candidate: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              headline: true,
              skills: true,
              location: true,
            },
          },
        },
      }),
    ]);

    return {
      data: records as unknown as MatchScoreResponse[],
      total,
      page,
      limit,
    };
  }

  /**
   * Fast indexed retrieval of recommended jobs for a candidate.
   */
  async getRankedJobsForCandidate(
    candidateId: string,
    query: QueryMatchmakerDto,
  ): Promise<{ data: MatchScoreResponse[]; total: number; page: number; limit: number }> {
    const { minScore = 0, page = 1, limit = 20, sortBy = MatchSortBy.TOTAL_SCORE } = query;

    const whereClause = {
      candidateId,
      totalScore: { gte: Number(minScore) },
    };

    const [total, records] = await Promise.all([
      this.prisma.matchScore.count({ where: whereClause }),
      this.prisma.matchScore.findMany({
        where: whereClause,
        orderBy: { [sortBy]: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          job: {
            select: {
              id: true,
              title: true,
              location: true,
              tags: true,
              experienceLevel: true,
              company: { select: { name: true } },
            },
          },
        },
      }),
    ]);

    return {
      data: records as unknown as MatchScoreResponse[],
      total,
      page,
      limit,
    };
  }

  /**
   * Aggregate statistics for administrative reporting and dashboards.
   */
  async getMatchAnalytics(): Promise<MatchAnalyticsResponse> {
    const [totalEvaluatedMatches, highQualityMatchesCount, aggregations] = await Promise.all([
      this.prisma.matchScore.count(),
      this.prisma.matchScore.count({ where: { totalScore: { gte: 75 } } }),
      this.prisma.matchScore.aggregate({
        _avg: {
          totalScore: true,
          skillScore: true,
          experienceScore: true,
        },
      }),
    ]);

    // Top matched skills sample analysis
    const sampleMatches = await this.prisma.matchScore.findMany({
      take: 100,
      select: { metadata: true },
    });

    const skillCounts: Record<string, number> = {};
    for (const match of sampleMatches) {
      const meta = match.metadata as unknown as MatchBreakdownMetadata | null;
      if (meta?.matchedSkills) {
        for (const skill of meta.matchedSkills) {
          const lower = skill.toLowerCase();
          skillCounts[lower] = (skillCounts[lower] || 0) + 1;
        }
      }
    }

    const topSkillsDistribution = Object.entries(skillCounts)
      .map(([skill, count]) => ({ skill, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalEvaluatedMatches,
      highQualityMatchesCount,
      averageTotalScore: Math.round(aggregations._avg.totalScore || 0),
      averageSkillScore: Math.round(aggregations._avg.skillScore || 0),
      averageExperienceScore: Math.round(aggregations._avg.experienceScore || 0),
      topSkillsDistribution,
    };
  }

  // ── Private Scoring Engine Methods ───────────────────────────────────────

  /**
   * Core multi-vector scoring logic computing overall total score and sub-scores.
   */
  private computePairwiseScores(
    candidate: { skills?: string[]; headline?: string; location?: string; bio?: string },
    job: {
      tags?: string[];
      requirements?: string;
      experienceLevel?: string;
      location?: string;
      title?: string;
      salaryMin?: number | null;
      salaryMax?: number | null;
      currency?: string | null;
    },
  ) {
    const candidateSkills = (candidate.skills || []).map((s) => s.toLowerCase().trim());
    const jobTags = (job.tags || []).map((t) => t.toLowerCase().trim());

    // 1. Skill Score (40% weight)
    const { skillScore, matchedSkills, missingSkills } = this.calculateSkillMatch(
      candidateSkills,
      jobTags,
      job.requirements,
    );

    // 2. Experience Score (30% weight)
    const experienceScore = this.calculateExperienceMatch(candidate.headline, job.experienceLevel);

    // 3. Education Score (15% weight)
    const educationScore = this.calculateEducationMatch(
      candidate.bio || candidate.headline,
      job.requirements,
    );

    // 4. Location Score (15% weight)
    const { locationScore, isRemote, matchedLocation } = this.calculateLocationMatch(
      candidate.location,
      job.location,
      job.title,
    );

    // Weighted Total Score calculation
    const totalScore = Math.min(
      100,
      Math.max(
        0,
        Math.round(
          skillScore * 0.4 + experienceScore * 0.3 + educationScore * 0.15 + locationScore * 0.15,
        ),
      ),
    );

    const metadata: MatchBreakdownMetadata = {
      matchedSkills,
      missingSkills,
      candidateExperienceHeadline: candidate.headline,
      jobExperienceRequired: job.experienceLevel || 'Not Specified',
      matchedLocation,
      isRemote,
    };

    return {
      skillScore: Math.round(skillScore),
      experienceScore: Math.round(experienceScore),
      educationScore: Math.round(educationScore),
      locationScore: Math.round(locationScore),
      totalScore,
      metadata,
    };
  }

  private calculateSkillMatch(
    candidateSkills: string[],
    jobTags: string[],
    jobRequirements?: string,
  ) {
    const candidateSkillSet = new Set(candidateSkills);

    // Extract additional requirement tokens if jobTags is empty
    let requiredSkills = [...new Set(jobTags)];
    if (requiredSkills.length === 0 && jobRequirements) {
      requiredSkills = this.tokenizeText(jobRequirements);
    }

    if (requiredSkills.length === 0) {
      return { skillScore: 85, matchedSkills: candidateSkills.slice(0, 5), missingSkills: [] };
    }

    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const reqSkill of requiredSkills) {
      if (
        candidateSkillSet.has(reqSkill) ||
        [...candidateSkillSet].some((cs) => cs.includes(reqSkill) || reqSkill.includes(cs))
      ) {
        matchedSkills.push(reqSkill);
      } else {
        missingSkills.push(reqSkill);
      }
    }

    const scoreFraction = matchedSkills.length / requiredSkills.length;
    const skillScore = Math.min(100, Math.round(scoreFraction * 100));

    return { skillScore, matchedSkills, missingSkills };
  }

  private calculateExperienceMatch(
    candidateHeadline?: string,
    jobExperienceLevel?: string,
  ): number {
    if (!jobExperienceLevel) return 85;

    const reqRank = SENIORITY_MAP[jobExperienceLevel.toUpperCase()] || 2;
    const headlineUpper = (candidateHeadline || '').toUpperCase();

    let candidateRank = 2; // Default to MID
    if (headlineUpper.includes('JUNIOR') || headlineUpper.includes('INTERN')) candidateRank = 1;
    else if (
      headlineUpper.includes('LEAD') ||
      headlineUpper.includes('PRINCIPAL') ||
      headlineUpper.includes('MANAGER')
    )
      candidateRank = 4;
    else if (headlineUpper.includes('SENIOR') || headlineUpper.includes('SR')) candidateRank = 3;

    const diff = candidateRank - reqRank;
    if (diff === 0) return 100; // Perfect match
    if (diff === 1) return 90; // 1 level higher -> Great
    if (diff === -1) return 70; // 1 level lower -> Moderate
    if (diff > 1) return 80; // Overqualified
    return 40; // Underqualified
  }

  private calculateEducationMatch(candidateText?: string, jobRequirements?: string): number {
    if (!jobRequirements) return 85;

    const text = (candidateText || '').toLowerCase();
    const req = jobRequirements.toLowerCase();

    if (req.includes('phd') || req.includes('doctorate')) {
      return text.includes('phd') || text.includes('doctorate') ? 100 : 50;
    }
    if (req.includes('master') || req.includes('msc')) {
      return text.includes('master') || text.includes('msc') || text.includes('phd') ? 100 : 65;
    }
    if (req.includes('bachelor') || req.includes('bsc') || req.includes('degree')) {
      return text.includes('bachelor') || text.includes('bsc') || text.includes('degree')
        ? 100
        : 75;
    }

    return 85;
  }

  private calculateLocationMatch(candidateLoc?: string, jobLoc?: string, jobTitle?: string) {
    const isRemote =
      (jobLoc || '').toLowerCase().includes('remote') ||
      (jobTitle || '').toLowerCase().includes('remote');

    if (isRemote) {
      return { locationScore: 100, isRemote: true, matchedLocation: 'Remote' };
    }

    if (!candidateLoc || !jobLoc) {
      return {
        locationScore: 70,
        isRemote: false,
        matchedLocation: candidateLoc || jobLoc || 'Unspecified',
      };
    }

    const cLoc = candidateLoc.toLowerCase().trim();
    const jLoc = jobLoc.toLowerCase().trim();

    if (cLoc === jLoc || cLoc.includes(jLoc) || jLoc.includes(cLoc)) {
      return { locationScore: 100, isRemote: false, matchedLocation: candidateLoc };
    }

    return {
      locationScore: 50,
      isRemote: false,
      matchedLocation: `${candidateLoc} (Job: ${jobLoc})`,
    };
  }

  private tokenizeText(text: string): string[] {
    const tokens = text
      .toLowerCase()
      .split(/[^a-z0-9#+]+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    return [...new Set(tokens)];
  }
}
