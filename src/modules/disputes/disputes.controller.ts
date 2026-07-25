import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Patch,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { DisputesService } from './disputes.service';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import { Request } from 'express';

@ApiTags('disputes')
@Controller('disputes')
export class DisputesController {
  constructor(private readonly svc: DisputesService) {}

  private getLang(req: Request): string | undefined {
    return (
      (req.headers['accept-language'] as string) ||
      (req.headers['x-custom-lang'] as string) ||
      (req.query.lang as string)
    );
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() dto: CreateDisputeDto, @CurrentUser() u: any, @Req() req: Request) {
    return this.svc.createDispute(u.userId, dto, this.getLang(req));
  }

  @Get('my')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getMyDisputes(@CurrentUser() u: any) {
    return this.svc.getMyDisputes(u.userId);
  }

  @Get('contract/:contractId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async getByContract(@Param('contractId') contractId: string, @CurrentUser() u: any) {
    return this.svc.getDisputeByContract(contractId, u.userId);
  }

  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async getAllDisputes() {
    return this.svc.fetchAllDisputes();
  }

  @Patch(':disputeId/resolve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  async resolveDispute(
    @Param('disputeId') disputeId: string,
    @Body() dto: ResolveDisputeDto,
    @CurrentUser() u: any,
    @Req() req: Request,
  ) {
    return this.svc.resolveDispute(
      disputeId,
      dto.resolution,
      dto.resolutionType,
      u.userId,
      dto.partialPercentage,
      this.getLang(req),
    );
  }
}
