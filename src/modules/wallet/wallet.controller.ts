// wallet.controller.ts
import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { WalletService, WithdrawDto, ConvertDto } from './wallet.service';

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

  /** Freelancer wallet balance converted live into each requested currency, e.g. ?target=USD,EUR */
  @Get('balances')
  getBalances(@CurrentUser() u: CurrentUserPayload, @Query('target') target?: string) {
    return this.svc.getBalancesInCurrencies(u.userId, target?.split(',').map((c) => c.trim()));
  }

  /** Employer wallet balance converted live into each requested currency, e.g. ?target=USD,EUR */
  @Get('employer/balances')
  getEmployerBalances(@CurrentUser() u: CurrentUserPayload, @Query('target') target?: string) {
    return this.svc.getEmployerBalancesInCurrencies(u.userId, target?.split(',').map((c) => c.trim()));
  }

  /** Live conversion preview between two supported currencies — no balance is touched. */
  @Post('convert')
  convert(@Body() dto: ConvertDto) { return this.svc.previewConvert(dto); }

  @Post('withdraw')
  @UseGuards(StepUpGuard)
  @SensitiveAction('wallet_withdraw')
  withdraw(@CurrentUser() u: CurrentUserPayload, @Body() dto: WithdrawDto) { return this.svc.withdraw(u.userId, dto); }
}
