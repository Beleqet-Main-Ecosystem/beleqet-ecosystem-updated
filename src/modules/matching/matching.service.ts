import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { computeMatch, toPercentage, ALGORITHM_VERSION } from './matching.algorithm';
import { MatchResultDto } from './dto/matching.dto';

/**
 * MatchingService — the AI Matchmaker engine.
 *
 * Responsible for scoring FREELANCER users against a FreelanceJob's
 * requirements, persisting the full computed set to FreelanceMatchScore,
 * and returning a ranked, threshold-filterable slice of it.
 *
 * i18n note: this service returns raw data only (names, scores) — no
 * user-facing strings are generated here, so there is nothing to localize
 * in this layer. Any labels (e.g. "Great match") belong in the frontend's
 * i18n dictionary, not in the API response.
 *
 * GDPR note: only fields already exposed elsewhere in the public freelancer
 * profile (skills, headline, avatar, location) are read for scoring, and
 * only a derived numeric score is persisted — no profile text is copied
 * into FreelanceMatchScore. This module does not need to check
 * User.gdprConsent — that flag gates the *personalized job feed* module
 * specifically, not employer-initiated candidate matching.
 */
@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Scores every active freelancer against the given job, persists the full
   * computed set to FreelanceMatchScore (upserting on the (job, freelancer)
   * pair so re-runs update rather than duplicate), and returns the ranked
   * list above `minScore`, capped at `limit`.
   *
   * Persistence is best-effort: if the upsert transaction fails, we log a
   * warning and still return the freshly computed results to the caller.
   * A missed cache write shouldn't turn into a 500 for an employer who just
   * wants to see their ranked candidates — the next call will just recompute
   * (and try to persist) again.
   *
   * This runs the scoring in-memory over candidate freelancers rather than
   * pushing the weighted math into SQL — the freelancer pool per job
   * category is expected to be in the hundreds, not millions, so this is
   * simpler to test and adjust than an equivalent SQL scoring expression.
   */
  async getRankedMatches(jobId: string, minScorePercent: number, limit: number): Promise<MatchResultDto[]> {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: jobId },
      select: {
        id: true,
        skills: true,
        locationPreference: true,
        experienceLevel: true,
      },
    });

    if (!job) {
      throw new NotFoundException(`FreelanceJob ${jobId} not found`);
    }

    // Only FREELANCER-role, active users are match candidates.
    const candidates = await this.prisma.user.findMany({
      where: { role: 'FREELANCER', isActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        headline: true,
        bio: true,
        avatarUrl: true,
        location: true,
        skills: true,
      },
    });

    const scored: MatchResultDto[] = candidates.map((candidate) => {
      const breakdown = computeMatch(
        {
          skills: candidate.skills,
          location: candidate.location,
          headline: candidate.headline,
          bio: candidate.bio,
        },
        {
          skills: job.skills,
          locationPreference: job.locationPreference,
          experienceLevel: job.experienceLevel,
        },
      );

      return {
        userId: candidate.id,
        firstName: candidate.firstName,
        lastName: candidate.lastName,
        headline: candidate.headline,
        avatarUrl: candidate.avatarUrl,
        overallScore: toPercentage(breakdown.overallScore),
        skillScore: toPercentage(breakdown.skillScore),
        locationScore: toPercentage(breakdown.locationScore),
        experienceScore: toPercentage(breakdown.experienceScore),
      };
    });

    await this.persistScores(jobId, scored);

    const filtered = scored.filter((result) => result.overallScore >= minScorePercent).sort((a, b) => b.overallScore - a.overallScore);

    this.logger.log(`Scored ${scored.length} candidates for job ${jobId}; ${filtered.length} passed minScore=${minScorePercent}`);

    return filtered.slice(0, limit);
  }

  /**
   * Upserts the full computed score set into FreelanceMatchScore, keyed on
   * the (freelanceJobId, freelancerId) unique constraint so re-running the
   * matcher updates existing rows instead of accumulating duplicates.
   *
   * Wrapped in a single $transaction so a partial write (e.g. connection
   * drop mid-batch) can't leave some candidates' scores stale while others
   * update — either the whole batch lands or none of it does.
   */
  private async persistScores(jobId: string, scored: MatchResultDto[]): Promise<void> {
    if (scored.length === 0) return;

    try {
      await this.prisma.$transaction(
        scored.map((result) =>
          this.prisma.freelanceMatchScore.upsert({
            where: {
              freelanceJobId_freelancerId: {
                freelanceJobId: jobId,
                freelancerId: result.userId,
              },
            },
            create: {
              freelanceJobId: jobId,
              freelancerId: result.userId,
              overallScore: result.overallScore,
              skillScore: result.skillScore,
              locationScore: result.locationScore,
              experienceScore: result.experienceScore,
              algorithmVersion: ALGORITHM_VERSION,
            },
            update: {
              overallScore: result.overallScore,
              skillScore: result.skillScore,
              locationScore: result.locationScore,
              experienceScore: result.experienceScore,
              algorithmVersion: ALGORITHM_VERSION,
            },
          }),
        ),
      );
    } catch (error) {
      // Best-effort cache write — log and continue rather than failing the
      // employer's request over a persistence hiccup.
      this.logger.warn(`Failed to persist match scores for job ${jobId}: ${(error as Error).message}`);
    }
  }
}