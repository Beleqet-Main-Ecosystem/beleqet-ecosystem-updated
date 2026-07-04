// freelance.controller.ts
import { Controller, Get, Post, Patch, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { FreelanceService, CreateFreelanceJobDto, CreateBidDto, CreateMilestoneDto } from './freelance.service';
import { EscrowService } from '../escrow/escrow.service';

@ApiTags('freelance')
@Controller('freelance')
export class FreelanceController {
  constructor(
    private readonly svc: FreelanceService,
    private readonly escrowSvc: EscrowService
  ) {}

  @Get('jobs')
  findJobs(@Query() q: { q?: string; category?: string; page?: number; limit?: number }) { return this.svc.findJobs(q); }

  @Get('jobs/:id')
  findJob(@Param('id') id: string) { return this.svc.findJobById(id); }

  @Post('jobs')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  createJob(@CurrentUser() u: CurrentUserPayload, @Body() dto: CreateFreelanceJobDto) { return this.svc.createJob(u.userId, dto); }

  @Post('jobs/:id/bids')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  submitBid(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload, @Body() dto: CreateBidDto) { return this.svc.submitBid(u.userId, id, dto); }

  @Patch('bids/:id/accept')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  acceptBid(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) { return this.svc.acceptBid(id, u.userId); }

  @Patch('bids/:id/reject')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  rejectBid(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) { return this.svc.rejectBid(id, u.userId); }

  @Get('my-bids')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  myBids(@CurrentUser() u: CurrentUserPayload) { return this.svc.getMyBids(u.userId); }

  @Get('my-contracts')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  myContracts(@CurrentUser() u: CurrentUserPayload) { return this.svc.getMyContracts(u.userId); }

  @Get('contracts/:id')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  contract(@Param('id') id: string) { return this.svc.getContract(id); }

  @Post('contracts/:id/milestones')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  createMilestone(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload, @Body() dto: CreateMilestoneDto) {
    return this.svc.createMilestone(u.userId, id, dto);
  }

  @Patch('milestones/:id/approve')
  @UseGuards(JwtAuthGuard) @ApiBearerAuth()
  approveMilestone(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) { return this.escrowSvc.releaseMilestone(id, u.userId); }
}
