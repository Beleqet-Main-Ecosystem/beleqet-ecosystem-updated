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
import * as crypto from 'crypto';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly svc: EscrowService,
    private readonly config: ConfigService,
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
    @Headers('chapa-signature') chapaSignature?: string,
    @Headers('x-chapa-signature') xChapaSignature?: string,
  ) {
    const signature = chapaSignature || xChapaSignature;
    const secret = this.config.get<string>('CHAPA_WEBHOOK_SECRET');
    const isProduction = this.config.get<string>('NODE_ENV') === 'production';

    // Verify signature only for POST requests that actually contain a body/signature
    if (req.method === 'POST') {
      if (isProduction && (!secret || !req.rawBody || !signature)) {
        throw new UnauthorizedException(
          'Webhook signature verification failed: missing required components',
        );
      }

      if (secret && req.rawBody && signature) {
        const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

        if (hash !== signature) {
          if (isProduction) {
            throw new UnauthorizedException('Invalid Webhook Signature');
          } else {
            console.warn(
              `[escrow-webhook] Signature mismatch in dev mode. Expected: ${signature}, Got: ${hash}`,
            );
          }
        }
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
        await this.svc.handleWebhook(payload as never);
        const frontendUrl = this.config.get<string>('FRONTEND_URL') || 'http://localhost:3000';
        return { url: `${frontendUrl}/freelance/payment-success` };
      }

      await this.svc.handleWebhook(payload as never);
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
}
