import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { PrismaService } from '../../../prisma/prisma.service';
import { MatchingService } from '../services/matching.service';
import { MatchRequestDto } from '../dto/match-request.dto';
import { MatchResponseDto } from '../dto/match-response.dto';
import { RankedCandidateResponseDto } from '../dto/ranked-candidate-response.dto';
import type { Job, JobSummary as _JobSummary } from '../interfaces/job.interface';
import type { MatchResult } from '../interfaces/match-result.interface';

/**
 * REST controller exposing the AI Matching pipeline.
 *
 * Accepts a job identifier and optional matching parameters,
 * delegates to MatchingService for the full pipeline, and
 * returns ranked candidates.
 */
@ApiTags('AI Matching')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-matching')
export class MatchingController {
  constructor(
    private readonly matchingService: MatchingService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Execute the full two-stage matching pipeline for a given job.
   *
   * Generates a job embedding, retrieves candidates via vector search,
   * runs LLM evaluation, computes composite scores, and returns
   * candidates ranked by match quality.
   *
   * @param dto - Request body containing the job ID and optional matching options.
   * @returns MatchResponseDto with session metadata and ranked candidates.
   * @throws NotFoundException when the job does not exist.
   */
  @Post('match')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Match candidates against a job posting' })
  @ApiBody({ type: MatchRequestDto })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Matching pipeline completed successfully',
    type: MatchResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid request body (validation failed)',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'Job not found',
  })
  @ApiResponse({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    description: 'Internal server error during matching',
  })
  async matchCandidate(@Body() dto: MatchRequestDto): Promise<MatchResponseDto> {
    const job = await this.buildJob(dto);
    const result = await this.matchingService.match(job, dto.matchingOptions);
    return this.toResponse(job.id, result);
  }

  /**
   * Load the job from the database and map to the internal Job interface.
   *
   * Tries FreelanceJob first (has direct skills/budget/clientId fields),
   * then falls back to Job (board-style listing with tags/salaryMax/company).
   *
   * @param dto - The validated request DTO.
   * @returns A fully populated Job domain object.
   * @throws NotFoundException when neither model contains the given ID.
   */
  private async buildJob(dto: MatchRequestDto): Promise<Job> {
    const freelance = await this.prisma.freelanceJob.findUnique({
      where: { id: dto.jobId },
      select: {
        id: true,
        title: true,
        description: true,
        skills: true,
        budgetMax: true,
        currency: true,
        clientId: true,
        createdAt: true,
      },
    });

    if (freelance) {
      return {
        id: freelance.id,
        title: freelance.title,
        description: freelance.description,
        requiredSkills: freelance.skills,
        preferredSkills: [],
        budget: freelance.budgetMax,
        currency: freelance.currency,
        locale: dto.matchingOptions?.locale ?? 'en',
        employerId: freelance.clientId,
        createdAt: freelance.createdAt,
      };
    }

    const board = await this.prisma.job.findUnique({
      where: { id: dto.jobId },
      include: { company: true },
    });

    if (!board) {
      throw new NotFoundException(`Job ${dto.jobId} not found`);
    }

    return {
      id: board.id,
      title: board.title,
      description: board.description,
      requiredSkills: board.tags,
      preferredSkills: [],
      budget: board.salaryMax ?? 0,
      currency: board.currency,
      locale: dto.matchingOptions?.locale ?? 'en',
      employerId: board.company.userId,
      createdAt: board.createdAt,
    };
  }

  /**
   * Map the internal MatchResult domain object to the public MatchResponseDto.
   */
  private toResponse(jobId: string, result: MatchResult): MatchResponseDto {
    return {
      sessionId: result.sessionId,
      jobId,
      candidates: result.rankedCandidates.map(this.toCandidateResponse),
    };
  }

  /**
   * Map a single RankedCandidate to its response DTO.
   */
  private toCandidateResponse(
    candidate: MatchResult['rankedCandidates'][number],
  ): RankedCandidateResponseDto {
    return {
      freelancerId: candidate.freelancerId,
      freelancerName: candidate.freelancerName,
      rank: candidate.rank,
      score: candidate.combinedScore,
      decision: candidate.decision,
      reasoningSnippet: candidate.reasoningSnippet,
      matchedSkills: candidate.matchedSkills,
      skillGaps: candidate.skillGaps,
    };
  }
}
