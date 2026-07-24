import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { GdprGuardService } from './gdpr-guard.service';
import { DataErasureRequestDto } from './dto/data-erasure-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

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
    return this.gdprGuardService.executeDataErasure(dto.userId, {
      reason: dto.reason,
      actorUserId: admin.userId,
    });
  }
}
