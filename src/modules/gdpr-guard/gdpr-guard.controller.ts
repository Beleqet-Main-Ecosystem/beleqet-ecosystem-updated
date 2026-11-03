import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Equals, IsOptional, IsString } from 'class-validator';
import { GdprGuardService } from './gdpr-guard.service';
import { DataErasureRequestDto } from './dto/data-erasure-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

class EraseMeDto {
  @IsOptional() @IsString() password?: string;
  /** Typed by the person so a stray click can't delete an account. */
  @Equals('DELETE') confirm!: 'DELETE';
}

@ApiTags('Compliance')
@Controller('v1/compliance/gdpr')
export class GdprGuardController {
  constructor(private readonly gdprGuardService: GdprGuardService) {}

  @Post('erase')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Admin-only GDPR data erasure for a target user' })
  @HttpCode(HttpStatus.OK)
  async requestErasure(
    @Body() dto: DataErasureRequestDto,
    @CurrentUser() admin: CurrentUserPayload,
  ): Promise<{ success: boolean; scrubbedAt: string; referenceId: string }> {
    await this.gdprGuardService.assertAdminMayErase(admin.userId, dto.userId);
    return this.gdprGuardService.executeDataErasure(dto.userId, {
      reason: dto.reason,
      actorUserId: admin.userId,
    });
  }

  /** Delete my own account: confirmed with the password (social-only accounts have none). */
  @Post('erase-me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete your own account and personal data' })
  @HttpCode(HttpStatus.OK)
  async eraseMe(@Body() dto: EraseMeDto, @CurrentUser() user: CurrentUserPayload) {
    return this.gdprGuardService.eraseOwnAccount(user.userId, dto.password);
  }
}
