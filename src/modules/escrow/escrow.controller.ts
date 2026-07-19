// escrow.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StepUpGuard } from '../two-factor/guards/step-up.guard';
import { SensitiveAction } from '../two-factor/decorators/sensitive-action.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ChapaSignatureService } from './chapa-signature.service';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';
import { ChapaWebhookPayload } from './chapa.types';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly svc: EscrowService,
    private readonly config: ConfigService,
    private readonly signatures: ChapaSignatureService,
  ) {}

  @Post('initiate/:gigId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  initiate(@Param('gigId') gigId: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.initiate(u.userId, gigId);
  }

  /** Webhook endpoint — verified via Chapa signature header */
  @SkipThrottle()
  @Post('callback')
  @Get('callback')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() body: Record<string, unknown>,
    @Req() req: Request & { rawBody?: Buffer },
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Headers('chapa-signature') chapaSignature?: string,
    @Headers('x-chapa-signature') xChapaSignature?: string,
  ) {
    const signature = chapaSignature || xChapaSignature;
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    // Verify signature for Chapa POST webhooks. GET callbacks are user redirects
    // and are verified later through the server-to-server Chapa transaction check.
    if (req.method === 'POST') {
      if (isProduction && (!secret || !req.rawBody || !signature)) {
        throw new UnauthorizedException(
          'Webhook signature verification failed: missing required components',
        );
      }

      if (secret && req.rawBody && signature && !this.signatures.verifyWebhook(req.rawBody, headers)) {
        throw new UnauthorizedException('Invalid Webhook Signature');
      }
    }

    // Merge body and query to support both POST webhooks and GET redirects from Chapa
    const payload = {
      ...body,
      ...req.query,
      tx_ref: req.query.trx_ref || body.tx_ref || req.query.tx_ref,
    };

    try {
      if (req.method === 'GET') {
        await this.svc.handleWebhook(payload as ChapaWebhookPayload);
        const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
        return { url: `${frontendUrl}/freelance/payment-success` };
      }

      await this.svc.handleWebhook(payload as ChapaWebhookPayload);
      console.log(`[escrow-webhook] Successfully added to queue for tx_ref: ${payload.tx_ref}`);
      return { success: true };
    } catch (error) {
      console.error(`[escrow-webhook] Queue execution failed!`, error);
      throw error;
    }
  }

  @Post('milestones/:id/release')
  @UseGuards(JwtAuthGuard, StepUpGuard)
  @SensitiveAction('milestone_release')
  @ApiBearerAuth()
  release(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.releaseMilestone(id, u.userId);
  }

  @Post('milestones/:id/confirm')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  confirm(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body() body: ConfirmMilestoneDto,
  ) {
    return this.svc.confirmMilestone(id, u.userId, body);
  }
}
