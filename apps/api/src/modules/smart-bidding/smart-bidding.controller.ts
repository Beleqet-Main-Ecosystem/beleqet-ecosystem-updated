import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SmartBiddingService } from './smart-bidding.service';
import { PredictBidResponseDto } from './dto/predict-bid-response.dto';
import { PrismaService } from '../../prisma/prisma.service';

@ApiTags('smart-bidding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('smart-bidding')
export class SmartBiddingController {
  constructor(
    private readonly svc: SmartBiddingService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('predict/:jobId')
  @ApiOperation({
    summary: 'Predict optimal bidding price for the authenticated freelancer',
    description:
      "Calculates recommendations based on the target job profile matched against the logged-in user's profile.",
  })
  predictForSelf(
    @Param('jobId') jobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PredictBidResponseDto> {
    return this.svc.predictBid(jobId, user.userId);
  }

  @Get('predict/:jobId/freelancer/:freelancerId')
  @ApiOperation({
    summary: 'Predict optimal bidding price for a specific freelancer',
    description:
      'Calculates bid recommendations for a specified freelancer ID, useful for admin/employer analysis.',
  })
  async predictForFreelancer(
    @Param('jobId') jobId: string,
    @Param('freelancerId') freelancerId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<PredictBidResponseDto> {
    // Fix 1 — Broken Employer RBAC (+ Data Exfiltration hardening):
    // Admins and the freelancer themselves are always allowed. Employers are
    // only allowed if BOTH (a) they own the job, AND (b) the target
    // freelancer has an actual Bid on that job — otherwise an employer could
    // create a throwaway job and enumerate arbitrary freelancerIds to leak
    // private metrics platform-wide.
    const isAdmin = user.role === 'ADMIN';
    const isFreelancer = user.userId === freelancerId;

    if (!isAdmin && !isFreelancer) {
      await this.assertEmployerCanViewFreelancer(jobId, freelancerId, user.userId);
    }

    return this.svc.predictBid(jobId, freelancerId);
  }

  @Get('predict-generic/:jobId')
  @ApiOperation({
    summary: 'Predict standard generic bidding price range for a job',
    description:
      'Calculates general bidding averages for a job without matching against any specific freelancer profile.',
  })
  predictGeneric(@Param('jobId') jobId: string): Promise<PredictBidResponseDto> {
    return this.svc.predictBid(jobId);
  }

  /**
   * Verifies an employer is allowed to view predictions for a specific
   * freelancer on a specific job. Two conditions must BOTH hold:
   *   1. The employer owns the job (job.clientId === employerId).
   *   2. The freelancer has an actual Bid on that job — proving a genuine
   *      relationship exists, not just an arbitrary freelancerId guess.
   *
   * Both failure cases throw the same generic ForbiddenException so the
   * response itself doesn't leak *why* access was denied.
   */
  private async assertEmployerCanViewFreelancer(
    jobId: string,
    freelancerId: string,
    employerId: string,
  ): Promise<void> {
    const job = await this.prisma.freelanceJob.findUnique({
      where: { id: jobId },
      select: { clientId: true },
    });

    if (!job) {
      throw new NotFoundException(`Freelance job with ID ${jobId} not found`);
    }

    const isJobOwner = job.clientId === employerId;
    const bidExists = isJobOwner
      ? await this.prisma.bid.findUnique({
          where: {
            freelanceJobId_freelancerId: { freelanceJobId: jobId, freelancerId },
          },
          select: { id: true },
        })
      : null;

    if (!isJobOwner || !bidExists) {
      throw new ForbiddenException(
        'You are not authorized to view bid predictions for other freelancers.',
      );
    }
  }
}
