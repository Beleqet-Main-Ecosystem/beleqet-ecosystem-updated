import { Controller, Post, Get, Param, Query, UseGuards, Body } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { AiMatchmakerService } from './ai-matchmaker.service';
import { QueryMatchmakerDto, TriggerMatchDto } from './dto/query-matchmaker.dto';

@ApiTags('ai-matchmaker')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('ai-matchmaker')
export class AiMatchmakerController {
  constructor(private readonly matchmakerService: AiMatchmakerService) {}

  @Post('calculate/:jobId')
  @ApiOperation({ summary: 'Enqueue asynchronous batch matching calculation for a job (BullMQ queue)' })
  enqueueBatchCalculation(@Param('jobId') jobId: string) {
    return this.matchmakerService.enqueueJobMatching(jobId);
  }

  @Post('pair/:jobId')
  @ApiOperation({ summary: 'Calculate and persist pairwise match between candidate and job' })
  calculatePairwiseMatch(
    @Param('jobId') jobId: string,
    @Body() dto: TriggerMatchDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const candidateId = dto?.candidateId || user.userId;
    return this.matchmakerService.calculateAndPersistMatch(candidateId, jobId);
  }

  @Get('job/:jobId/candidates')
  @ApiOperation({ summary: 'Get ranked candidates for a job filtered by minScore threshold' })
  @ApiQuery({ name: 'minScore', required: false, type: Number, description: 'Score threshold filter (0-100)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRankedCandidatesForJob(
    @Param('jobId') jobId: string,
    @Query() query: QueryMatchmakerDto,
  ) {
    return this.matchmakerService.getRankedCandidatesForJob(jobId, query);
  }

  @Get('candidate/:candidateId/jobs')
  @ApiOperation({ summary: 'Get recommended job matches for a candidate profile' })
  @ApiQuery({ name: 'minScore', required: false, type: Number, description: 'Score threshold filter (0-100)' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getRankedJobsForCandidate(
    @Param('candidateId') candidateId: string,
    @Query() query: QueryMatchmakerDto,
  ) {
    return this.matchmakerService.getRankedJobsForCandidate(candidateId, query);
  }

  @Get('analytics')
  @ApiOperation({ summary: 'Get platform-wide AI Matchmaker aggregate statistics' })
  getMatchAnalytics() {
    return this.matchmakerService.getMatchAnalytics();
  }
}
