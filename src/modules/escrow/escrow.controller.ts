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
  Delete,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';
import * as crypto from 'crypto';
import { Request } from 'express';

@ApiTags('escrow')
@Controller('escrow')
export class EscrowController {
  constructor(
    private readonly svc: EscrowService,
    private readonly config: ConfigService,
    private readonly i18n: I18nService,
  ) {}

  private getLang(req: Request): string | undefined {
    return (
      (req.headers['accept-language'] as string) ||
      (req.headers['x-custom-lang'] as string) ||
      (req.query.lang as string)
    );
  }

  @Post('initiate/:gigId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  initiate(
    @Param('gigId', ParseUUIDPipe) gigId: string,
    @CurrentUser() u: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.svc.initiate(u.userId, gigId, this.getLang(req));
  }

  /** Webhook endpoint — verified via Chapa signature header */
  @Post('callback')
  @Get('callback')
  @Throttle({ short: { ttl: 1_000, limit: 5 } })
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

    if (req.method === 'POST') {
      if (isProduction && (!secret || !req.rawBody || !signature)) {
        throw new UnauthorizedException(
          this.i18n.t('escrow.missingWebhookComponents', {
            defaultValue: 'Webhook signature verification failed: missing required components',
          }),
        );
      }

      if (secret && req.rawBody && signature) {
        const hash = crypto.createHmac('sha256', secret).update(req.rawBody).digest('hex');

        if (hash !== signature) {
          if (isProduction) {
            throw new UnauthorizedException(
              this.i18n.t('escrow.invalidWebhookSignature', {
                defaultValue: 'Invalid Webhook Signature',
              }),
            );
          } else {
            console.warn(
              `[escrow-webhook] Signature mismatch in dev mode. Expected: ${signature}, Got: ${hash}`,
            );
          }
        }
      }
    }

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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async release(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: CurrentUserPayload) {
    try {
      return await this.svc.releaseMilestone(id, u.userId);
    } catch (e) {
      console.error('RELEASE EXCEPTION:', e);
      throw e;
    }
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listMyEscrows(
    @CurrentUser() u: CurrentUserPayload,
    @Req() req: Request & { query: { page?: string; limit?: string } },
  ) {
    const page = parseInt(req.query.page || '1', 10);
    const limit = Math.min(parseInt(req.query.limit || '20', 10), 50);
    return this.svc.listByClient(u.userId, page, limit);
  }

  @Get('summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getSummary(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getEmployerEscrowSummary(u.userId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getEscrowDetail(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.getByIdForClient(id, u.userId);
  }

  @Get('freelancer/list')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  listEscrowsForFreelancer(@Req() req: Request, @CurrentUser() u: CurrentUserPayload) {
    const page = parseInt((req.query.page as string) || '1', 10);
    const limit = Math.min(parseInt((req.query.limit as string) || '20', 10), 50);
    return this.svc.listByFreelancer(u.userId, page, limit);
  }

  @Get('freelancer/summary')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getFreelancerSummary(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getFreelancerEscrowSummary(u.userId);
  }

  @Get('freelancer/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  getEscrowDetailForFreelancer(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: CurrentUserPayload,
  ) {
    return this.svc.getByIdForFreelancer(id, u.userId);
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  adminGetDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.adminGetEscrowDetail(id);
  }

  @Post('admin/:id/force-release')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  adminForceRelease(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.adminForceRelease(id, u.userId);
  }

  @Post('admin/:id/force-refund')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  adminForceRefund(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.svc.adminForceRefund(id, u.userId, this.getLang(req));
  }

  @Delete(':escrowId/cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  cancel(
    @Param('escrowId', ParseUUIDPipe) escrowId: string,
    @CurrentUser() u: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.svc.cancelEscrow(escrowId, u.userId, this.getLang(req));
  }

  @Post('contracts/:contractId/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  completeContract(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() u: CurrentUserPayload,
    @Req() req: Request,
  ) {
    return this.svc.completeContract(contractId, u.userId, this.getLang(req));
  }
}
