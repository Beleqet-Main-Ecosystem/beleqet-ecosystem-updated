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
import { KycDocumentType, KycStatus } from '@prisma/client';
import { SubmitKycDto } from './dto/submit-kyc.dto';

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
    @Inject('KycProvider') private readonly kycProvider: KycProvider,
  ) {}

  /**
   * Generates secure pre-signed upload URLs so the Next.js frontend can
   * push identity documents and face scans directly to S3/R2 storage.
   *
   * @param userId Authenticated user identifier.
   */
  async createPresignedUploadTokens(userId: string) {
    const uniqueId = crypto.randomUUID();

    // Define unique filenames/keys
    const docFilename = `${userId}-${uniqueId}-document.jpg`;
    const faceFilename = `${userId}-${uniqueId}-facescan.jpg`;

    this.logger.log(`Generating dual pre-signed upload targets for user context: ${userId}`);

    // Clean fix: Passing parameters properly aligning to (filename, contentType, folder) signatures
    const [docUploadData, faceUploadData] = await Promise.all([
      this.uploadsService.generatePresignedUrl(docFilename, 'image/jpeg', 'kyc-documents/ids'),
      this.uploadsService.generatePresignedUrl(faceFilename, 'image/jpeg', 'kyc-documents/selfies'),
    ]);

    return {
      documentStorageKey: docUploadData.key,
      faceScanStorageKey: faceUploadData.key,
      documentUploadUrl: docUploadData.presignedUrl,
      faceScanUploadUrl: faceUploadData.presignedUrl,
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
    const { documentType, documentStorageKey, faceScanStorageKey } = dto;

    // Concurrently check state to shield the runtime from race conditions
    const existing = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });

    if (existing) {
      if (existing.status === KycStatus.PENDING) {
        throw new ConflictException('Identity verification is already processing. Please wait.');
      }
      if (existing.status === KycStatus.APPROVED) {
        throw new ConflictException('Account identity has already been verified.');
      }
    }

    this.logger.log(
      `Downloading private cloud verification streams into memory for user: ${userId}`,
    );

    // Clean fix: Fetch private cloud files down into memory buffers as required by the third-party provider interface
    const [documentBuffer, faceScanBuffer] = await Promise.all([
      this.uploadsService.getFileBuffer(documentStorageKey),
      this.uploadsService.getFileBuffer(faceScanStorageKey),
    ]);

    this.logger.log(`Invoking remote biometrics matching engine using pulled memory buffers.`);

    // Clean fix: Passing both buffers AND their respective MIME types to satisfy KycVerificationInput
    const providerResult = await this.kycProvider.verify({
      documentBuffer,
      faceScanBuffer,
      documentMimeType: 'image/jpeg',
      faceScanMimeType: 'image/jpeg',
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
        rejectionReason = `Automated verification failure. Score: ${providerResult.matchScore}%, Liveness: ${providerResult.livenessPassed}, Authenticity: ${providerResult.isDocumentValid}.`;
      }
    }

    this.logger.log(
      `Biometrics evaluation complete (${status}). Syncing record keys down to persistence layer.`,
    );

    // Persist all tracking parameters and trigger user flags atomically inside a database transaction
    const result = await this.prisma.$transaction(async (tx) => {
      const kyc = await tx.kycVerification.upsert({
        where: { userId },
        update: {
          documentType,
          documentUrl: documentStorageKey,
          faceScanUrl: faceScanStorageKey,
          status,
          matchScore: providerResult.matchScore,
          livenessPassed: providerResult.livenessPassed,
          rejectionReason,
          verifiedAt: status === KycStatus.APPROVED ? new Date() : null,
        },
        create: {
          userId,
          documentType,
          documentUrl: documentStorageKey,
          faceScanUrl: faceScanStorageKey,
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
          payload: { userId, status, matchScore: providerResult.matchScore },
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
   * Retrieves the current KYC verification record for a user.
   */
  async getVerificationStatus(userId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({
      where: { userId },
    });
    if (!kyc) {
      throw new NotFoundException('No active identity records identified for this user context.');
    }
    return kyc;
  }

  /**
   * Retrieves all pending KYC verification requests with readable temporary pre-signed URLs for internal admins.
   */
  async getPendingVerifications() {
    const records = await this.prisma.kycVerification.findMany({
      where: { status: KycStatus.PENDING },
      include: {
        user: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return Promise.all(
      records.map(async (record) => {
        // Generate short-lived GET presigned urls so admins can inspect private photos securely
        const [docUrlData, faceUrlData] = await Promise.all([
          this.uploadsService.generatePresignedUrl(record.documentUrl, 'image/jpeg'),
          this.uploadsService.generatePresignedUrl(record.faceScanUrl, 'image/jpeg'),
        ]);

        return {
          ...record,
          documentUrl: docUrlData.presignedUrl,
          faceScanUrl: faceUrlData.presignedUrl,
        };
      }),
    );
  }

  /**
   * Approves a KYC verification request manually.
   */
  async approveVerification(id: string, adminId: string) {
    const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException('Target record reference could not be identified.');

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
   * Rejects a KYC verification request manually.
   */
  async rejectVerification(id: string, adminId: string, reason: string) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('Explicit rejection arguments must be supplied.');
    }

    const kyc = await this.prisma.kycVerification.findUnique({ where: { id } });
    if (!kyc) throw new NotFoundException('Target record reference could not be identified.');

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
