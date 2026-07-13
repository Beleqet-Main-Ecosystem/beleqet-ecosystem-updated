import { Body, Controller, Get, Param, Post, UseGuards, Patch } from '@nestjs/common';

import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiCreatedResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { KycService } from './kyc.service';

import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';

import { SubmitKycDto } from './dto/submit-kyc.dto';
import { RejectKycDto } from './dto/reject-kyc.dto';
import { VerificationIdParamDto } from './dto/verificationId-param.dto';
import { GenerateUploadUrlsDto } from './dto/generate-upload-urls.dto';

/**
 * Exposes REST endpoints for Know Your Customer (KYC) verification.
 *
 * Responsibilities:
 * - Generate temporary upload URLs for identity documents.
 * - Receive uploaded document references.
 * - Retrieve verification status.
 * - Provide administrator review endpoints.
 *
 * This controller intentionally contains no business logic.
 * All verification workflows are delegated to {@link KycService}.
 *
 * Security:
 * - JWT authentication is required for every endpoint.
 * - Administrative endpoints additionally require the ADMIN role.
 */
@ApiTags('KYC')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('kyc')
export class KycController {
  /**
   * Creates a new KYC controller.
   *
   * @param kycService Service responsible for KYC workflows.
   */
  constructor(private readonly kycService: KycService) {}

  /**
   * Generates temporary upload URLs that allow authenticated users
   * to upload identity documents directly to private cloud storage.
   *
   * Files never pass through the backend application, reducing
   * server bandwidth usage and improving scalability.
   *
   * @param user Currently authenticated user.
   *
   * @returns Upload URLs and object keys for the required KYC assets.
   */
  @Post('upload-urls')
  @ApiOperation({
    summary: 'Generate temporary upload URLs',
  })
  @ApiBody({
    type: GenerateUploadUrlsDto,
  })
  @ApiCreatedResponse({
    description: 'Temporary upload URLs generated successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Unsupported file type supplied.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  async generateUploadUrls(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: GenerateUploadUrlsDto,
  ) {
    return this.kycService.generateUploadUrls(
      user.userId,
      dto.documentContentType,
      dto.faceScanContentType,
    );
  }

  /**
   * Submits uploaded identity document references for
   * verification.
   *
   * The frontend uploads files directly to cloud storage and
   * submits only the generated storage keys.
   *
   * Validation is performed automatically by the global
   * ValidationPipe and SubmitKycDto decorators.
   *
   * @param user Authenticated user.
   * @param dto Submitted verification payload.
   *
   * @returns Created verification record.
   */
  @Post('verifications')
  @ApiConsumes('application/json')
  @ApiOperation({
    summary: 'Submit a new KYC verification request',
  })
  @ApiBody({
    type: SubmitKycDto,
  })
  @ApiCreatedResponse({
    description: 'KYC verification submitted successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid verification request.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  async submitVerification(@CurrentUser() user: CurrentUserPayload, @Body() dto: SubmitKycDto) {
    return this.kycService.submitVerification(user.userId, dto);
  }
  /**
   * Retrieves the authenticated user's current verification
   * status.
   *
   * Typical states include:
   *
   * - Pending
   * - Approved
   * - Rejected
   * - Requires Resubmission
   *
   * @param user Authenticated user.
   *
   * @returns Verification status.
   */
  @Get('verification-status')
  @ApiOperation({
    summary: "Retrieve the authenticated user's KYC verification status",
  })
  @ApiOkResponse({
    description: 'Verification status retrieved successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  async getVerificationStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getVerificationStatus(user.userId);
  }
  /**
   * Retrieves all pending KYC verification requests.
   *
   * This endpoint is restricted to administrators and is intended
   * for manual verification and compliance review workflows.
   *
   * @returns Collection of pending verification records.
   */
  @Get('admin/verifications/pending')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Retrieve pending KYC submissions (Admin)',
  })
  @ApiOkResponse({
    description: 'Pending verification requests retrieved successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  @ApiForbiddenResponse({
    description: 'Administrator privileges required.',
  })
  async getPendingVerifications() {
    return this.kycService.getPendingVerifications();
  }

  /**
   * Approves a pending KYC verification.
   *
   * This endpoint is available only to administrators after
   * reviewing the submitted identity documents.
   *
   * @param id Verification identifier.
   * @param admin Currently authenticated administrator.
   *
   * @returns Updated verification record.
   */
  @Patch('admin/verifications/:id/approve')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Approve a KYC verification (Admin)',
  })
  @ApiOkResponse({
    description: 'Verification approved successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  @ApiForbiddenResponse({
    description: 'Administrator privileges required.',
  })
  async approve(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.kycService.approveVerification(id, admin.userId);
  }
  /**
   * Rejects a pending KYC verification.
   *
   * Administrators must provide a rejection reason, allowing
   * the applicant to understand why the verification failed
   * and what needs to be corrected before resubmission.
   *
   * @param id Verification identifier.
   * @param admin Currently authenticated administrator.
   * @param dto Rejection details.
   *
   * @returns Updated verification record.
   */

  @Patch('admin/verifications/:id/reject')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Reject a KYC verification (Admin)',
  })
  @ApiBody({
    type: RejectKycDto,
  })
  @ApiOkResponse({
    description: 'Verification rejected successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Authentication required.',
  })
  @ApiForbiddenResponse({
    description: 'Administrator privileges required.',
  })
  async reject(
    @Param() params: VerificationIdParamDto,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.rejectVerification(params.id, admin.userId, dto.reason);
  }
}
