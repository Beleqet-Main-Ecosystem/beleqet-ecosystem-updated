// users.controller.ts
import { Controller, Delete, Get, Patch, Put, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { UsersService } from './users.service';
import { UpdateUserDto, CreateCompanyDto, SaveCvDraftDto } from './dto/update-user.dto';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly svc: UsersService) {}

  @Get('profile')
  profile(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.findById(u.userId);
  }

  @Patch('profile')
  update(@CurrentUser() u: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.svc.update(u.userId, dto);
  }

  @Get('company')
  getCompany(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getCompany(u.userId);
  }

  @Post('company')
  createCompany(@CurrentUser() u: CurrentUserPayload, @Body() dto: CreateCompanyDto) {
    return this.svc.createCompany(u.userId, dto);
  }

  @Get('notifications')
  notifications(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getNotifications(u.userId);
  }

  @Patch('notifications/:id/read')
  markRead(@Param('id') id: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.markNotificationRead(id, u.userId);
  }

  @Patch('notifications/read-all')
  markAllRead(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.markAllNotificationsRead(u.userId);
  }

  @Get('saved-jobs')
  savedJobs(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getSavedJobs(u.userId);
  }

  @Post('saved-jobs/:jobId')
  saveJob(@Param('jobId') jobId: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.saveJob(u.userId, jobId);
  }

  @Delete('saved-jobs/:jobId')
  removeSavedJob(@Param('jobId') jobId: string, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.removeSavedJob(u.userId, jobId);
  }

  @Get('cv-draft')
  cvDraft(@CurrentUser() u: CurrentUserPayload) {
    return this.svc.getCvDraft(u.userId);
  }

  @Put('cv-draft')
  saveCvDraft(@Body() dto: SaveCvDraftDto, @CurrentUser() u: CurrentUserPayload) {
    return this.svc.saveCvDraft(u.userId, dto.data);
  }
}
