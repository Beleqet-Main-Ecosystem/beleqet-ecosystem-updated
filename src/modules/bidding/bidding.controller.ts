import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiddingService, SuggestBidResponse } from './bidding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

/**
 * Controller for Smart Bidding price suggestions.
 */
@ApiTags('Bidding')
@Controller('api/v1/bidding')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  /**
   * Get AI-assisted bid price suggestion for a freelance job.
   * 
   * @param freelanceJobId - UUID of the job to get a suggestion for
   * @param user - Authenticated user making the request
   * @returns Suggested price with rationale and budget constraints
   */
  @Get('suggest/:freelanceJobId')
  @ApiOperation({ summary: 'Get bid price suggestion for a freelance job' })
  @ApiResponse({ 
    status: 200, 
    description: 'Price suggestion calculated successfully',
  })
  @ApiResponse({ status: 404, description: 'Freelance job not found' })
  async suggestBidPrice(
    @Param('freelanceJobId') freelanceJobId: string,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SuggestBidResponse> {
    return this.biddingService.suggestPrice(user.userId, freelanceJobId);
  }
}
