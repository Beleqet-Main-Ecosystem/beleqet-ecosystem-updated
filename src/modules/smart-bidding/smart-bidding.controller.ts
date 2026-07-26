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
    // Fix 1 — Broken Employer RBAC:
    // Allow access to ADMINs, the freelancer themselves, OR the employer who
    // posted the job.  A plain `user.userId === freelancerId` check was locking
    // out employers who have a legitimate need to analyze bid predictions for
    // applicants on their own job postings.
    const isAdmin = user.role === 'ADMIN';
    const isFreelancer = user.userId === freelancerId;

    if (!isAdmin && !isFreelancer) {
      // Fetch just the clientId — lean select to keep the DB call cheap.
      const job = await this.prisma.freelanceJob.findUnique({
        where: { id: jobId },
        select: { clientId: true },
      });

      if (!job) {
        throw new NotFoundException(`Freelance job with ID ${jobId} not found`);
      }

      const isJobOwner = job.clientId === user.userId;
      if (!isJobOwner) {
        throw new ForbiddenException(
          'You are not authorized to view bid predictions for other freelancers.',
        );
      }
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
}
