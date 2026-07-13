import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadsService } from '../uploads/uploads.service';
import { KycProvider } from './providers/kyc-provider.interface';
import { KycStatus } from '@prisma/client';
import { SubmitKycDto } from './dto/submit-kyc.dto';
import { isSupportedKycMimeType, getExtensionFromMimeType } from './utils/kyc-file.util';
import { I18nService } from 'nestjs-i18n';
import { KycUploadUrlsResponse } from './interfaces/kyc-upload-response.interface';
/**
 * Handles Know Your Customer (KYC) verification workflows.
 *
 * Responsibilities:
 * - Generate pre-signed secure target keys and write URLs for the frontend client.
 * - Download private asset binaries securely into volatile runtime memory buffers.
 * - Validate identity tracking references against strict third-party provider interfaces.
 * - Manage atomic status changes and logging events in Prisma transactions.
 *
 * @service KycService
 */
@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  /** Minimum match score required for automatic approval. */
  private readonly autoApproveThreshold = 80.0;

  /** Match score below this threshold triggers automatic rejection. */
  private readonly autoRejectThreshold = 50.0;

  /**
   * Creates a new KYC service instance.
   */
  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadsService: UploadsService,
    private readonly i18n: I18nService,
    @Inject('KycProvider') private readonly kycProvider: KycProvider,
  ) {}

  /**
   * Generates temporary upload URLs for KYC assets.
   *
   * The returned URLs allow authenticated users to upload identity
   * documents and facial images directly to private cloud storage
   * without routing file contents through the backend application.
   *
   * Each generated URL is:
   * - Unique
   * - Time-limited
   * - Intended for a single upload operation
   *
   * @param userId Authenticated user's unique identifier.
   *
   * @returns Storage keys and temporary upload URLs for the required
   * KYC identity assets.
   */

  async generateUploadUrls(
    userId: string,
    documentContentType: string,
    faceScanContentType: string,
  ): Promise<KycUploadUrlsResponse> {
    const invalidFileTypeMessage = await this.i18n.translate('uploads.invalid_file_type');

    if (!isSupportedKycMimeType(documentContentType)) {
      throw new BadRequestException(invalidFileTypeMessage);
    }

    if (!isSupportedKycMimeType(faceScanContentType)) {
      throw new BadRequestException(invalidFileTypeMessage);
    }
    const uniqueId = crypto.randomUUID();
    const documentExtension = getExtensionFromMimeType(documentContentType);
    const faceScanExtension = getExtensionFromMimeType(faceScanContentType);
    const docFilename = `${uniqueId}-document.${documentExtension}`;
    const faceFilename = `${uniqueId}-facescan.${faceScanExtension}`;
    this.logger.log('Generating secure KYC upload URLs.');

    // Passing parameters properly aligning to (filename, contentType, folder) signatures
    const [documentUpload, faceScanUpload] = await Promise.all([
      this.uploadsService.generateUploadUrl(docFilename, documentContentType, 'kyc-documents/ids'),

      this.uploadsService.generateUploadUrl(
        faceFilename,
        faceScanContentType,
        'kyc-documents/selfies',
      ),
    ]);

    return {
      documentStorageKey: documentUpload.key,
      faceScanStorageKey: faceScanUpload.key,
      documentUploadUrl: documentUpload.uploadUrl,
      faceScanUploadUrl: faceScanUpload.uploadUrl,
    };
  }

  /**
   * Submits a new KYC verification request based on pre-uploaded cloud storage references.
   *
   * @param userId User requesting verification.
   * @param dto Verification submission payload holding target S3 storage strings.
   *
   * @returns Verification result summary.
   */
  async submitVerification(userId: string, dto: SubmitKycDto) {
    const {
      documentType,
      documentStorageKey,
      faceScanStorageKey,
      documentMimeType,
      faceScanMimeType,
    } = dto;

    // Check existing verification state before starting processing.
    const existing = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === KycStatus.PENDING) {
        throw new ConflictException(await this.i18n.translate('uploads.already_pending'));
      }
      if (existing.status === KycStatus.APPROVED) {
        throw new ConflictException(await this.i18n.translate('uploads.already_verified'));
      }
    }

    this.logger.log('Downloading private KYC verification assets.');

    // Fetch private cloud files down into memory buffers as required by the third-party provider interface
    let documentBuffer: Buffer;
    let faceScanBuffer: Buffer;

    try {
      [documentBuffer, faceScanBuffer] = await Promise.all([
        this.uploadsService.getFileBuffer(documentStorageKey),
        this.uploadsService.getFileBuffer(faceScanStorageKey),
      ]);
    } catch (error) {
      throw new BadRequestException(await this.i18n.translate('uploads.invalid_upload_reference'));
    }

    this.logger.log(`Invoking remote biometrics matching engine using pulled memory buffers.`);

    const providerResult = await this.kycProvider.verify({
      documentBuffer,
      faceScanBuffer,
      documentMimeType,
      faceScanMimeType,
    });

    // Determine verification status branch
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
        rejectionReason = `Automated verification failed. Score: ${providerResult.matchScore}%.`;
      }
    }

    this.logger.log(`Biometric evaluation completed with status: ${status}.`);
    const verificationData = {
      documentType,
      documentUrl: documentStorageKey,
      faceScanUrl: faceScanStorageKey,
      status,
      matchScore: providerResult.matchScore,
      livenessPassed: providerResult.livenessPassed,
      rejectionReason,
      verifiedAt: status === KycStatus.APPROVED ? new Date() : null,
    };
    const result = await this.prisma.$transaction(async (tx) => {
      const kyc = await tx.kycVerification.upsert({
        where: { userId },
        update: verificationData,

        create: {
          userId,
          ...verificationData,
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
          payload: { userId, status, matchScore: providerResult.matchScore },
          processedBy: KycService.name,
        },
      });

      return kyc;
    });
    let message: string;

    switch (result.status) {
      case KycStatus.APPROVED:
        message = await this.i18n.translate('uploads.verification_approved');
        break;

      case KycStatus.REJECTED:
        message = await this.i18n.translate('uploads.verification_rejected');
        break;

      default:
        message = await this.i18n.translate('uploads.verification_pending');
    }
    return {
      status: result.status,
      matchScore: result.matchScore,
      livenessPassed: result.livenessPassed,
      rejectionReason: result.rejectionReason,
      verifiedAt: result.verifiedAt,
      message,
    };
  }

  /**
   * Retrieves the current KYC verification status for an authenticated user.
   *
   * Returns only user-safe verification information.
   *
   * @param userId Authenticated user's unique identifier.
   *
   * @throws NotFoundException
   * Thrown when no verification record exists.
   */
  async getVerificationStatus(userId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    if (!kyc) {
      throw new NotFoundException(await this.i18n.translate('uploads.not_found'));
    }

    return {
      status: kyc.status,
      matchScore: kyc.matchScore,
      livenessPassed: kyc.livenessPassed,
      rejectionReason: kyc.rejectionReason,
      verifiedAt: kyc.verifiedAt,
      createdAt: kyc.createdAt,
    };
  }

  /**
   * Retrieves pending KYC verification requests for administrator review.
   *
   * Generates short-lived download URLs for private identity documents.
   * Files remain private and are accessible only through temporary
   * authenticated URLs.
   *
   * @returns Pending verification records with secure document previews.
   */
  async getPendingVerifications() {
    const records = await this.prisma.kycVerification.findMany({
      where: {
        status: KycStatus.PENDING,
      },
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
      orderBy: {
        createdAt: 'asc',
      },
    });

    return Promise.all(
      records.map(async (record) => {
        const [documentDownloadUrl, faceScanDownloadUrl] = await Promise.all([
          this.uploadsService.generateDownloadUrl(record.documentUrl),
          this.uploadsService.generateDownloadUrl(record.faceScanUrl),
        ]);

        return {
          ...record,
          documentUrl: documentDownloadUrl,
          faceScanUrl: faceScanDownloadUrl,
        };
      }),
    );
  }

  /**
   * Approves a pending KYC verification request manually.
   *
   * Only administrators can perform this operation.
   *
   * The operation updates:
   * - KYC verification status
   * - User verification flag
   * - Compliance audit log
   *
   * All changes are executed inside a database transaction
   * to maintain consistency.
   *
   * @param id KYC verification identifier.
   * @param adminId Administrator performing the action.
   *
   * @returns Updated KYC verification record.
   */
  async approveVerification(id: string, adminId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { id },
    });

    if (!kyc) {
      throw new NotFoundException(await this.i18n.translate('uploads.not_found'));
    }

    if (kyc.status === KycStatus.APPROVED) {
      throw new ConflictException(await this.i18n.translate('uploads.already_approved'));
    }

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException(await this.i18n.translate('uploads.invalid_status_transition'));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedKyc = await tx.kycVerification.update({
        where: { id },
        data: {
          status: KycStatus.APPROVED,
          rejectionReason: null,
          verifiedAt: new Date(),
        },
      });

      await tx.user.update({
        where: {
          id: kyc.userId,
        },
        data: {
          kycVerified: true,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'kyc.approved',
          entityId: id,
          entityType: 'KycVerification',
          payload: {
            adminId,
            userId: kyc.userId,
            previousStatus: kyc.status,
            newStatus: KycStatus.APPROVED,
          },
          processedBy: KycService.name,
        },
      });

      return updatedKyc;
    });

    this.logger.log(`Admin ${adminId} approved KYC verification ${id}`);

    return result;
  }
  /**
   * Rejects a pending KYC verification request manually.
   *
   * Only administrators can perform this operation.
   *
   * The operation updates:
   * - KYC verification status
   * - User verification flag
   * - Compliance audit history
   *
   * All changes are executed atomically inside a database transaction.
   *
   * @param id KYC verification identifier.
   * @param adminId Administrator performing the rejection.
   * @param reason Reason for rejecting the verification.
   *
   * @returns Updated KYC verification record.
   */
  async rejectVerification(id: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException(await this.i18n.translate('uploads.rejection_reason_required'));
    }

    const kyc = await this.prisma.kycVerification.findUnique({
      where: {
        id,
      },
    });

    if (!kyc) {
      throw new NotFoundException(await this.i18n.translate('uploads.not_found'));
    }

    if (kyc.status === KycStatus.REJECTED) {
      throw new ConflictException(await this.i18n.translate('uploads.already_rejected'));
    }

    if (kyc.status !== KycStatus.PENDING) {
      throw new BadRequestException(await this.i18n.translate('uploads.invalid_status_transition'));
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updatedKyc = await tx.kycVerification.update({
        where: {
          id,
        },
        data: {
          status: KycStatus.REJECTED,
          rejectionReason: reason.trim(),
          verifiedAt: null,
        },
      });

      await tx.user.update({
        where: {
          id: kyc.userId,
        },
        data: {
          kycVerified: false,
        },
      });

      await tx.eventLog.create({
        data: {
          eventType: 'kyc.rejected',
          entityId: id,
          entityType: 'KycVerification',
          payload: {
            adminId,
            userId: kyc.userId,
            previousStatus: kyc.status,
            newStatus: KycStatus.REJECTED,
            reason: reason.trim(),
          },
          processedBy: KycService.name,
        },
      });

      return updatedKyc;
    });

    this.logger.log(`Admin ${adminId} rejected KYC verification ${id}`);

    return result;
  }
}
