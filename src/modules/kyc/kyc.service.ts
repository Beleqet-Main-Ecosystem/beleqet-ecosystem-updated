import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { KycProvider } from './providers/kyc-provider.interface';
import { KycDocumentType, KycStatus } from '@prisma/client';
import { KycUploadFile } from './kyc.controller';

/**
 * Service managing Know Your Customer (KYC) identity verifications.
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);
  private readonly autoApproveThreshold = 80.0;
  private readonly autoRejectThreshold = 50.0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    @Inject('KycProvider') private readonly kycProvider: KycProvider,
  ) {}

  /**
   * Submits files for KYC verification, triggers AI checks, and records results.
   *
   * @param userId - ID of the professional submitting the files.
   * @param documentType - Type of uploaded ID card or passport.
   * @param documentFile - Multer file object for the ID document.
   * @param faceScanFile - Multer file object for the live face scan/selfie.
   * @returns Detailed verification and status object.
   */
  async submitVerification(
    userId: string,
    documentType: KycDocumentType,
    documentFile: KycUploadFile | null | undefined,
    faceScanFile: KycUploadFile | null | undefined,
  ) {
    if (!documentFile || !faceScanFile) {
      throw new BadRequestException('Both identification document and live face scan files are required.');
    }

    // Verify existing KYC status to prevent double-submissions
    const existing = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === KycStatus.PENDING) {
        throw new ConflictException('You have a verification pending review. Please wait.');
      }
      if (existing.status === KycStatus.APPROVED) {
        throw new ConflictException('Your account is already KYC verified.');
      }
    }

    this.logger.log(`Uploading KYC files to private storage for user: ${userId}`);

    // Upload files securely to private kyc-documents folder
    const [docUpload, faceUpload] = await Promise.all([
      this.uploadsService.uploadFile(documentFile, 'kyc-documents/ids'),
      this.uploadsService.uploadFile(faceScanFile, 'kyc-documents/selfies'),
    ]);

    this.logger.log(`Invoking face matching and liveness verification provider`);

    // Match document with live scan
    const providerResult = await this.kycProvider.verify(
      documentFile.buffer,
      faceScanFile.buffer,
    );

    // Determine verification status based on thresholds
    let status: KycStatus = KycStatus.PENDING;
    let rejectionReason = providerResult.rejectionReason || null;

    if (
      providerResult.isDocumentValid &&
      providerResult.livenessPassed &&
      providerResult.matchScore >= this.autoApproveThreshold
    ) {
      status = KycStatus.APPROVED;
    } else if (
      !providerResult.isDocumentValid ||
      !providerResult.livenessPassed ||
      providerResult.matchScore < this.autoRejectThreshold
    ) {
      status = KycStatus.REJECTED;
      if (!rejectionReason) {
        rejectionReason = `Verification failed. Face Match: ${providerResult.matchScore}%. Liveness: ${providerResult.livenessPassed}. Document Valid: ${providerResult.isDocumentValid}.`;
      }
    }

    // Atomically save verification status and update user record
    const result = await this.prisma.$transaction(async (tx) => {
      const kyc = await tx.kycVerification.upsert({
        where: { userId },
        update: {
          documentType,
          documentUrl: docUpload.publicUrl,
          faceScanUrl: faceUpload.publicUrl,
          status,
          matchScore: providerResult.matchScore,
          livenessPassed: providerResult.livenessPassed,
          rejectionReason,
          verifiedAt: status === KycStatus.APPROVED ? new Date() : null,
        },
        create: {
          userId,
          documentType,
          documentUrl: docUpload.publicUrl,
          faceScanUrl: faceUpload.publicUrl,
          status,
          matchScore: providerResult.matchScore,
          livenessPassed: providerResult.livenessPassed,
          rejectionReason,
          verifiedAt: status === KycStatus.APPROVED ? new Date() : null,
        },
      });

      await tx.user.update({
        where: { id: userId },
        data: { kycVerified: status === KycStatus.APPROVED },
      });

      await tx.eventLog.create({
        data: {
          eventType: `kyc.submitted.${status.toLowerCase()}`,
          entityId: kyc.id,
          entityType: 'KycVerification',
          payload: {
            userId,
            status,
            matchScore: providerResult.matchScore,
            livenessPassed: providerResult.livenessPassed,
            isDocumentValid: providerResult.isDocumentValid,
          },
          processedBy: KycService.name,
        },
      });

      return kyc;
    });

    return {
      status: result.status,
      matchScore: result.matchScore,
      livenessPassed: result.livenessPassed,
      rejectionReason: result.rejectionReason,
      verifiedAt: result.verifiedAt,
    };
  }

  /**
   * Retrieves KYC verification record of a user.
   *
   * @param userId - ID of the user whose status is queried.
   * @returns The user's KYC verification database record.
   */
  async getVerificationStatus(userId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });
    if (!kyc) {
      throw new NotFoundException('No KYC record found for this user.');
    }
    return kyc;
  }

  /**
   * Lists all PENDING KYC verifications for review.
   *
   * @returns List of verifications with matching user profiles.
   */
  async getPendingVerifications() {
    return this.prisma.kycVerification.findMany({
      where: { status: KycStatus.PENDING },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Approves a user's KYC verification request manually (Admin action).
   *
   * @param id - The ID of the KYC verification record.
   * @param adminId - Admin performing the action.
   * @returns The updated KYC verification status.
   */
  async approveVerification(id: string, adminId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException('KYC verification record not found.');

    return this.prisma.$transaction(async (tx) => {
      const updatedKyc = await tx.kycVerification.update({
        where: { id },
        data: {
          status: KycStatus.APPROVED,
          rejectionReason: null,
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: { kycVerified: true },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'kyc.approved',
          entityId: id,
          entityType: 'KycVerification',
          payload: { adminId, userId: kyc.userId },
          processedBy: KycService.name,
        },
      });

      return updatedKyc;
    });
  }

  /**
   * Rejects a user's KYC verification request manually (Admin action).
   *
   * @param id - The ID of the KYC verification record.
   * @param adminId - Admin performing the action.
   * @param reason - Rejection reason explanation.
   * @returns The updated KYC verification status.
   */
  async rejectVerification(id: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Rejection reason must be provided.');
    }

    const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException('KYC verification record not found.');

    return this.prisma.$transaction(async (tx) => {
      const updatedKyc = await tx.kycVerification.update({
        where: { id },
        data: {
          status: KycStatus.REJECTED,
          rejectionReason: reason,
          verifiedAt: null,
        },
      });

      await tx.user.update({
        where: { id: kyc.userId },
        data: { kycVerified: false },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'kyc.rejected',
          entityId: id,
          entityType: 'KycVerification',
          payload: { adminId, userId: kyc.userId, reason },
          processedBy: KycService.name,
        },
      });

      return updatedKyc;
    });
  }
}
