// wallet.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { WalletService, WithdrawDto } from './wallet.service';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly svc: WalletService) {}

  @Get()
  getWallet(@CurrentUser() u: CurrentUserPayload) { return this.svc.getOrCreate(u.userId); }

  @Get('employer')
  getEmployerWallet(@CurrentUser() u: CurrentUserPayload) { return this.svc.getEmployerWallet(u.userId); }

  @Post('withdraw')
  withdraw(@CurrentUser() u: CurrentUserPayload, @Body() dto: WithdrawDto) { return this.svc.withdraw(u.userId, dto); }
}
