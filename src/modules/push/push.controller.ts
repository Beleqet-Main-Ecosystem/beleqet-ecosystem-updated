import { Body, Controller, Delete, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { PushService } from './push.service';

export class RegisterPushTokenDto {
  @IsString()
  @MaxLength(200)
  token: string;

  @IsOptional()
  @IsIn(['android', 'ios'])
  platform?: 'android' | 'ios';
}

/** The mobile app registers its push token after sign-in and removes it on sign-out. */
@ApiTags('users')
@Controller('users/push-tokens')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PushController {
  constructor(private readonly push: PushService) {}

  @Post()
  register(@CurrentUser() user: CurrentUserPayload, @Body() dto: RegisterPushTokenDto) {
    return this.push.register(user.userId, dto.token, dto.platform);
  }

  @Delete(':token')
  remove(@CurrentUser() user: CurrentUserPayload, @Param('token') token: string) {
    return this.push.remove(user.userId, token);
  }
}
