import { Controller, Get, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { NotificationsService, UpdatePreferencesDto, RegisterPushDto } from './notifications.service';

@ApiTags('notifications')
@Controller('notifications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('preferences')
  @ApiOperation({ summary: 'Get user notification channel preferences' })
  async getPreferences(@CurrentUser() u: CurrentUserPayload) {
    return this.notificationsService.getPreferences(u.userId);
  }

  @Patch('preferences')
  @ApiOperation({ summary: 'Update user notification channel preferences' })
  async updatePreferences(@CurrentUser() u: CurrentUserPayload, @Body() dto: UpdatePreferencesDto) {
    return this.notificationsService.updatePreferences(u.userId, dto);
  }

  @Post('push/register')
  @ApiOperation({ summary: 'Register browser Web Push notification credentials' })
  async registerPush(@CurrentUser() u: CurrentUserPayload, @Body() dto: RegisterPushDto) {
    return this.notificationsService.registerPushToken(u.userId, dto);
  }
}
