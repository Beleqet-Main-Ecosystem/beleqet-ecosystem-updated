import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SmartBiddingService } from './smart-bidding.service';
import { PredictBidResponseDto } from './dto/predict-bid-response.dto';

@ApiTags('smart-bidding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('smart-bidding')
export class SmartBiddingController {
  constructor(private readonly svc: SmartBiddingService) {}

  @Get('predict/:jobId')
  @ApiOperation({
    summary: 'Predict optimal bidding price for the authenticated freelancer',
    description: 'Calculates recommendations based on the target job profile matched against the logged-in user\'s profile.',
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
    description: 'Calculates bid recommendations for a specified freelancer ID, useful for admin/employer analysis.',
  })
  predictForFreelancer(
    @Param('jobId') jobId: string,
    @Param('freelancerId') freelancerId: string,
  ): Promise<PredictBidResponseDto> {
    return this.svc.predictBid(jobId, freelancerId);
  }

  @Get('predict-generic/:jobId')
  @ApiOperation({
    summary: 'Predict standard generic bidding price range for a job',
    description: 'Calculates general bidding averages for a job without matching against any specific freelancer profile.',
  })
  predictGeneric(@Param('jobId') jobId: string): Promise<PredictBidResponseDto> {
    return this.svc.predictBid(jobId);
  }
}
