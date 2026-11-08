// freelance.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { VerifiedEmailGuard } from '../../common/guards/verified-email.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import {
  FreelanceService,
  CreateFreelanceJobDto,
  CreateBidDto,
  FreelanceQueryDto,
  CreateMilestoneDto,
  SubmitDeliverableDto,
  RaiseDisputeDto,
} from './freelance.service';
import { EscrowService } from '../escrow/escrow.service';

@ApiTags('freelance')
@Controller('freelance')
export class FreelanceController {
  constructor(
    private readonly svc: FreelanceService,
    private readonly escrowSvc: EscrowService,
  ) {}

  @Get('categories')
  findCategories() {
    return this.svc.findCategories();
  }

  @Get('jobs')
  findJobs(@Query() q: FreelanceQueryDto) {
    return this.svc.findJobs(q);
  }

  // Before jobs/:id, so "saved" is not read as a project id.
  @Get('saved')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  savedProjects(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.savedProjects(u.userId);
  }

  @Post('jobs/:id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  saveProject(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.saveProject(u.userId, id);
  }

  @Delete('jobs/:id/save')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  unsaveProject(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.unsaveProject(u.userId, id);
  }

  @Get('jobs/:id/bids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  findBids(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.findBids(id, u.userId);
  }

  @Get('jobs/:id')
  findJob(@Param('id') id: string) {
    return this.svc.findJobById(id);
  }

  @Post('jobs')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  @ApiBearerAuth()
  createJob(@CurrentUser() u: CurrentUserPayload, @Body() dto: CreateFreelanceJobDto) {
    return this.svc.createJob(u.userId, dto);
  }

  @Post('jobs/:id/bids')
  @UseGuards(JwtAuthGuard, VerifiedEmailGuard)
  @ApiBearerAuth()
  submitBid(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body() dto: CreateBidDto,
  ) {
    return this.svc.submitBid(u.userId, id, dto);
  }

  @Patch('bids/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  acceptBid(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.acceptBid(id, u.userId);
  }

  @Patch('bids/:id/reject')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  rejectBid(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.rejectBid(id, u.userId);
  }

  @Get('my-bids')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  myBids(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getMyBids(u.userId);
  }

  @Get('my-projects')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  myProjects(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getMyProjects(u.userId);
  }

  @Get('my-contracts')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  myContracts(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getMyContracts(u.userId);
  }

  @Get('contracts/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  contract(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.getContract(id, u.userId);
  }

  @Post('contracts/:id/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  raiseDispute(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body() dto: RaiseDisputeDto,
  ) {
    return this.svc.raiseDispute(u.userId, id, dto);
  }

  @Post('contracts/:id/milestones')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  createMilestone(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body() dto: CreateMilestoneDto,
  ) {
    return this.svc.createMilestone(u.userId, id, dto);
  }

  @Patch('milestones/:id/accept')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  acceptMilestone(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.acceptMilestone(u.userId, id);
  }

  @Delete('milestones/:id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  declineMilestone(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.declineMilestone(u.userId, id);
  }

  @Patch('milestones/:id/approve')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  approveMilestone(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.escrowSvc.releaseMilestone(id, u.userId);
  }

  @Post('milestones/:id/deliverables')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  submitDeliverable(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body() dto: SubmitDeliverableDto,
  ) {
    return this.svc.submitDeliverable(u.userId, id, dto);
  }

  @Patch('milestones/:id/request-revision')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  requestRevision(
    @Param('id') id: string,
    @CurrentUser() u: CurrentUserPayload,
    @Body('reason') reason?: string,
  ) {
    return this.svc.requestRevision(u.userId, id, reason);
  }
}
