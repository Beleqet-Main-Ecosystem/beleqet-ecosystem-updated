import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { ChapaSignatureService } from '../escrow/chapa-signature.service';
import { CreateCampaignDto, ListCampaignsQueryDto, RankCampaignsDto } from './dto/create-campaign.dto';
import { CampaignsService } from './campaigns.service';
import { CampaignPaymentService } from './campaign-payment.service';

@ApiTags('campaigns')
@Controller('campaigns')
export class CampaignsController {
  constructor(
    private readonly campaigns: CampaignsService,
    private readonly payments: CampaignPaymentService,
    private readonly signatures: ChapaSignatureService,
    private readonly config: ConfigService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(user.userId, dto, user.email);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  list(@CurrentUser() user: CurrentUserPayload, @Query() query: ListCampaignsQueryDto) {
    return this.campaigns.listForOwner(user.userId, query.status);
  }

  /**
   * Auction ranking for a search query (authenticated; used by search surfaces).
   */
  @Post('rank')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  rank(@Body() dto: RankCampaignsDto) {
    return this.campaigns.rank(dto.query, dto.targetType, dto.limit);
  }

  /**
   * Chapa payment confirmation webhook for campaign budget authorization.
   * Transitions PENDING_PAYMENT → ACTIVE or REJECTED.
   */
  @SkipThrottle()
  @Post('webhook/chapa')
  @HttpCode(HttpStatus.OK)
  async chapaWebhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Headers('chapa-signature') chapaSignature?: string,
    @Headers('x-chapa-signature') xChapaSignature?: string,
  ) {
    const signature = chapaSignature || xChapaSignature;
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');

    if (!secret || !req.rawBody || !signature) {
      throw new UnauthorizedException(
        'Webhook signature verification failed: missing required components',
      );
    }
    if (!this.signatures.verifyWebhook(req.rawBody, headers)) {
      throw new UnauthorizedException('Invalid Webhook Signature');
    }

    return this.payments.handlePaymentWebhook(body);
  }

  @Get(':id/metrics')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  metrics(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.campaigns.getMetrics(user.userId, id);
  }

  @Patch(':id/pause')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  pause(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.campaigns.pause(user.userId, id);
  }

  @Patch(':id/resume')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  resume(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.campaigns.resume(user.userId, id);
  }
}
