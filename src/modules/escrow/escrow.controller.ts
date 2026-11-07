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
  Query,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { StepUpGuard } from '../two-factor/guards/step-up.guard';
import { SensitiveAction } from '../two-factor/decorators/sensitive-action.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { SkipThrottle } from '@nestjs/throttler';
import { ChapaSignatureService } from './chapa-signature.service';
import { ConfirmMilestoneDto } from './dto/confirm-milestone.dto';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly svc: EscrowService,
    private readonly config: ConfigService,
    private readonly signatures: ChapaSignatureService,
  ) {}

  @Post('initiate/:gigId')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  @ApiBearerAuth()
  initiate(@Param('gigId') gigId: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.initiate(u.userId, gigId);
  }

  /** Webhook endpoint — verified via Chapa signature header */
  @SkipThrottle()
  @Post('callback')
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

    if (!secret || !req.rawBody || !signature) {
      throw new UnauthorizedException(
        'Webhook signature verification failed: missing required components',
      );
    }
    if (!this.signatures.verifyWebhook(req.rawBody, headers)) {
      throw new UnauthorizedException('Invalid Webhook Signature');
    }

    const payload = { ...body, tx_ref: body.tx_ref ?? body.trx_ref };
    await this.svc.handleWebhook(
      payload as unknown as { reference: string; status: string; [k: string]: unknown },
    );
    return { success: true };
  }

  /**
   * Chapa's `callback_url`: called with `?trx_ref=…&status=…` (server to server, and from its
   * checkout page) when a payment ends. It is unsigned, so it only queues a check: nothing changes
   * until Chapa's verify endpoint confirms the payment. (A separate handler: a second method
   * decorator on the POST handler is never registered, so these calls used to get 404.)
   */
  @SkipThrottle()
  @Get('callback')
  @HttpCode(HttpStatus.OK)
  async callback(@Query() query: Record<string, unknown>) {
    const txRef = query.trx_ref ?? query.tx_ref;
    if (typeof txRef !== 'string' || !txRef) return { received: false };
    await this.svc.handleWebhook({
      tx_ref: txRef,
      reference: typeof query.ref_id === 'string' ? query.ref_id : txRef,
      status: typeof query.status === 'string' ? query.status : '',
    });
    return { received: true };
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
