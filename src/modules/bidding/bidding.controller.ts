import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { BiddingService } from './bidding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { SuggestBidDto, SuggestBidResponse } from './dto/suggest-bid.dto';

/**
 * Controller for Smart Bidding price suggestions.
 */
@ApiTags('bidding')
@Controller('bidding')
export class BiddingController {
  constructor(private readonly biddingService: BiddingService) {}

  /**
   * Get AI-assisted bid price suggestion for a freelance job.
   *
   * @param params - Route params containing the freelance job UUID.
   * @param user - Authenticated user making the request
   * @returns Suggested price with rationale and budget constraints
   */
  @Get('suggest/:freelanceJobId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get bid price suggestion for a freelance job' })
  @ApiResponse({
    status: 200,
    description: 'Price suggestion calculated successfully',
  })
  @ApiResponse({ status: 404, description: 'Freelance job not found' })
  async suggestBidPrice(
    @Param() params: SuggestBidDto,
    @CurrentUser() user: CurrentUserPayload,
  ): Promise<SuggestBidResponse> {
    return this.biddingService.suggestPrice(user.userId, params.freelanceJobId);
  }
}
