import { Controller, Get, Delete, Patch, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../common/decorators/permissions.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { GdprService } from './gdpr.service';
import { UserRole, Permission } from '../../common/constants/roles';

/**
 * GDPR Controller - Handles data privacy and user rights
 * @class GdprController
 */
@Controller('gdpr')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiTags('gdpr')
@ApiBearerAuth()
export class GdprController {
  constructor(private gdprService: GdprService) {}

  /**
   * Export user data (GDPR Right to Access)
   * @param user - Current authenticated user
   * @returns {Promise<object>} - User data export
   */
  @Get('export')
  @RequirePermissions(Permission.EXPORT_USER_DATA)
  @ApiOperation({ summary: 'Export user data (GDPR Right to Access)' })
  async exportData(@CurrentUser() user: CurrentUserPayload) {
    return this.gdprService.exportUserData(user.userId);
  }

  /**
   * Delete user account (GDPR Right to be Forgotten)
   * @param user - Current authenticated user
   * @returns {Promise<object>} - Success message
   */
  @Delete('account')
  @RequirePermissions(Permission.DELETE_USER_ACCOUNT)
  @ApiOperation({ summary: 'Delete user account (GDPR Right to be Forgotten)' })
  async deleteAccount(@CurrentUser() user: CurrentUserPayload) {
    return this.gdprService.deleteUserAccount(user.userId);
  }

  /**
   * Get user's consent preferences
   * @param user - Current authenticated user
   * @returns {Promise<object>} - Consent preferences
   */
  @Get('consents')
  @RequirePermissions(Permission.VIEW_CONSENTS)
  @ApiOperation({ summary: 'Get user consent preferences' })
  async getConsents(@CurrentUser() user: CurrentUserPayload) {
    return this.gdprService.getConsents(user.userId);
  }

  /**
   * Update user's consent preferences
   * @param user - Current authenticated user
   * @param consentData - Consent preferences to update
   * @returns {Promise<object>} - Updated consent preferences
   */
  @Patch('consents')
  @RequirePermissions(Permission.UPDATE_CONSENTS)
  @ApiOperation({ summary: 'Update user consent preferences' })
  async updateConsents(
    @CurrentUser() user: CurrentUserPayload,
    @Body() consentData: {
      consentMarketing?: boolean;
      consentAnalytics?: boolean;
      consentDataProcessing?: boolean;
    },
  ) {
    return this.gdprService.updateConsents(user.userId, consentData);
  }
}