import {
  Controller,
  Get,
  Param,
  Query,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';
import { MatchingService } from './matching.service';
import { GetMatchesQueryDto, JobIdParamDto, MatchResultDto } from './dto/matching.dto';

/**
 * AI Matchmaker API.
 *
 * GET /matching/jobs/:jobId/matches?minScore=60&limit=20
 *   Returns freelancers ranked by match score (desc) for the given job,
 *   filtered to scores >= minScore.
 *
 * Access control mirrors the pattern established in smart-bidding.controller.ts:
 * ADMIN can view any job's matches; an EMPLOYER can only view matches for a
 * FreelanceJob they own (job.clientId === the caller's userId). Freelancers
 * have no legitimate reason to see other candidates' rankings for a job, so
 * they are not granted access here.
 */
@ApiTags('matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('jobs/:jobId/matches')
  @Roles('ADMIN', 'EMPLOYER')
  @ApiOperation({
    summary: 'Get ranked freelancer matches for a freelance job',
    description:
      'Returns freelancers scored and ranked against the given job, filtered to overallScore >= minScore.',
  })
  async getMatches(
    @Param() params: JobIdParamDto,
    @Query() query: GetMatchesQueryDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<MatchResultDto[]> {
    if (user.role !== 'ADMIN') {
      await this.assertEmployerOwnsJob(params.jobId, user.userId);
    }

    return this.matchingService.getRankedMatches(
      params.jobId,
      query.minScore ?? 0,
      query.limit ?? 20,
    );
  }

  /**
   * Verifies the calling employer owns the target job before they can see
   * candidate match scores for it. Mirrors the ownership check in
   * smart-bidding.controller.ts — same reasoning: without this, any
   * authenticated employer could enumerate arbitrary jobIds and read
   * ranked profile data for jobs that aren't theirs.
   */
  private async assertEmployerOwnsJob(jobId: string, employerId: string): Promise<void> {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: jobId },
      select: { clientId: true },
    });

    if (!job) {
      throw new NotFoundException(`Freelance job with ID ${jobId} not found`);
    }

    if (job.clientId !== employerId) {
      throw new ForbiddenException('You are not authorized to view matches for this job.');
    }
  }
}
