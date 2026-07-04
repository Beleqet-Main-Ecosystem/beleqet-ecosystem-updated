import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiOperation, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';
import { KycService } from './kyc.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, CurrentUserPayload } from '../../common/decorators/current-user.decorator';
import { KycDocumentType } from '@prisma/client';

/**
 * Interface representing uploaded KYC files.
 */
export interface KycUploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

/**
 * Data transfer object representing a KYC submission request.
 */
export class SubmitKycDto {
  /** The type of uploaded ID card or passport */
  @IsEnum(KycDocumentType, { message: 'documentType must be PASSPORT, NATIONAL_ID, or DRIVERS_LICENSE' })
  @IsNotEmpty()
  documentType: KycDocumentType;
}

/**
 * Data transfer object for admin rejection requests.
 */
export class RejectKycDto {
  /** The reason why verification is rejected */
  @IsString()
  @IsNotEmpty()
  @MinLength(5, { message: 'Rejection reason must be at least 5 characters long' })
  reason: string;
}

/**
 * REST controller for KYC identity submission and admin reviews.
 */
@ApiTags('kyc')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('kyc')
export class KycController {
  constructor(private readonly kycService: KycService) {}

  /**
   * Submits professional ID documents and selfie checks.
   *
   * @param files - Uploaded identification document and live face scan file fields.
   * @param user - Current authenticated user details.
   * @param dto - Metadata parameters describing the document type.
   * @returns Submission status and results.
   */
  @Post('submit')
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Submit ID card and live face scan files for identity verification' })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'document', maxCount: 1 },
      { name: 'faceScan', maxCount: 1 },
    ]),
  )
  async submitKyc(
    @UploadedFiles()
    files: {
      document?: KycUploadFile[];
      faceScan?: KycUploadFile[];
    },
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: SubmitKycDto,
  ) {
    const documentFile = files?.document?.[0];
    const faceScanFile = files?.faceScan?.[0];

    if (!documentFile || !faceScanFile) {
      throw new BadRequestException('Both identification document and live face scan files must be uploaded.');
    }

    return this.kycService.submitVerification(
      user.userId,
      dto.documentType,
      documentFile,
      faceScanFile,
    );
  }

  /**
   * Retrieves the current logged-in user's verification status.
   *
   * @param user - Current authenticated user details.
   * @returns The user's KYC record.
   */
  @Get('status')
  @ApiOperation({ summary: 'Check current KYC verification status and records' })
  async getStatus(@CurrentUser() user: CurrentUserPayload) {
    return this.kycService.getVerificationStatus(user.userId);
  }

  /**
   * Lists all pending KYC verification requests for manual review (Admin action).
   *
   * @returns List of PENDING verification requests.
   */
  @Get('admin/pending')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'List all pending KYC submissions (Admin only)' })
  async getPending() {
    return this.kycService.getPendingVerifications();
  }

  /**
   * Approves a pending verification manually (Admin action).
   *
   * @param id - The KYC verification record ID.
   * @param admin - The current authenticated admin payload.
   * @returns The approved KYC verification record status.
   */
  @Post('admin/approve/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Approve a pending KYC submission (Admin only)' })
  async approve(@Param('id') id: string, @CurrentUser() admin: CurrentUserPayload) {
    return this.kycService.approveVerification(id, admin.userId);
  }

  /**
   * Rejects a pending verification manually (Admin action).
   *
   * @param id - The KYC verification record ID.
   * @param admin - The current authenticated admin payload.
   * @param dto - Rejection parameters explaining the decision.
   * @returns The rejected KYC verification record status.
   */
  @Post('admin/reject/:id')
  @UseGuards(RolesGuard)
  @Roles('ADMIN')
  @ApiOperation({ summary: 'Reject a pending KYC submission (Admin only)' })
  async reject(
    @Param('id') id: string,
    @CurrentUser() admin: CurrentUserPayload,
    @Body() dto: RejectKycDto,
  ) {
    return this.kycService.rejectVerification(id, admin.userId, dto.reason);
  }
}
