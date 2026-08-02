import { Injectable, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

export interface DataErasureAuditContext {
  reason: string;
  actorUserId: string;
}

/** Personal keys Chapa (and similar) may echo in escrow webhook payloads. */
const GATEWAY_RESPONSE_PII_KEYS = new Set([
  'first_name',
  'last_name',
  'email',
  'mobile',
  'account_name',
  'account_number',
]);

@Injectable()
export class GdprGuardService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly ivLength = 12;
  private readonly secretKey: Buffer;

  constructor(private readonly prisma: PrismaService) {
    const keyEnv = process.env.GDPR_ENCRYPTION_KEY;
    if (!keyEnv || keyEnv.length !== 64) {
      throw new InternalServerErrorException(
        'GDPR_ENCRYPTION_KEY must be defined in environment variables as a 64-character hex string.',
      );
    }
    this.secretKey = Buffer.from(keyEnv, 'hex');
  }

  encryptPii(text: string): string {
    if (!text) return text;
    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipheriv(this.algorithm, this.secretKey, iv) as crypto.CipherGCM;

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag().toString('hex');
      return `${iv.toString('hex')}:${authTag}:${encrypted}`;
    } catch {
      throw new InternalServerErrorException(
        'Failed to securely encrypt personal identifiable information.',
      );
    }
  }

  decryptPii(encryptedText: string): string {
    if (!encryptedText || !encryptedText.includes(':')) return encryptedText;
    try {
      const [ivHex, authTagHex, encryptedDataHex] = encryptedText.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipheriv(
        this.algorithm,
        this.secretKey,
        iv,
      ) as crypto.DecipherGCM;
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encryptedDataHex, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch {
      throw new InternalServerErrorException(
        'Failed to decrypt personal identifiable information.',
      );
    }
  }

  /**
   * Strip known personal keys from gateway webhook JSON while keeping
   * transactional fields (status, amount, currency, references, etc.).
   */
  scrubGatewayResponsePii(value: unknown): unknown {
    if (Array.isArray(value)) {
      return value.map((item) => this.scrubGatewayResponsePii(item));
    }
    if (value !== null && typeof value === 'object') {
      const result: Record<string, unknown> = {};
      for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
        if (GATEWAY_RESPONSE_PII_KEYS.has(key)) continue;
        result[key] = this.scrubGatewayResponsePii(nested);
      }
      return result;
    }
    return value;
  }

  async executeDataErasure(
    userUuid: string,
    audit: DataErasureAuditContext,
  ): Promise<{ success: boolean; scrubbedAt: string; referenceId: string }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userUuid },
      include: { wallet: true, employerWallet: true, company: true },
    });

    if (!user) {
      throw new NotFoundException(`User with ID ${userUuid} was not found in the ecosystem.`);
    }

    const scrubbedAt = new Date().toISOString();
    const referenceId = crypto.randomBytes(8).toString('hex').toUpperCase();
    const scrubbedEmail = `scrubbed-${crypto.randomBytes(4).toString('hex')}@beleqet.internal`;
    const originalEmail = user.email;

    await this.prisma.$transaction(async (tx) => {
      // Contact form submissions are not FK-linked to User — match by email first.
      await tx.contactMessage.updateMany({
        where: { email: originalEmail },
        data: {
          name: 'GDPR_ANONYMOUS',
          email: scrubbedEmail,
          message: 'GDPR_SCRUBBED',
          subject: 'GDPR_SCRUBBED',
        },
      });

      // Anonymize the user row (keep the row so financial/ledger FKs remain valid).
      // Cascade deletes do NOT fire — related PII must be scrubbed/deleted explicitly below.
      await tx.user.update({
        where: { id: userUuid },
        data: {
          firstName: 'GDPR_ANONYMOUS',
          lastName: 'USER',
          email: scrubbedEmail,
          phone: null,
          avatarUrl: null,
          telegramId: null,
          bio: null,
          headline: null,
          location: null,
          skills: [],
          defaultResumeUrl: null,
          githubUrl: null,
          linkedinUrl: null,
          portfolioUrl: null,
          clientFeedback: Prisma.DbNull,
          passwordHash: crypto.randomBytes(32).toString('hex'),
          isActive: false,
          emailVerified: false,
          gdprConsent: false,
          kycVerified: false,
          skillVerified: false,
        },
      });

      // Credentials / sessions / auth factors that Cascade would have removed on user delete.
      await tx.refreshToken.deleteMany({ where: { userId: userUuid } });
      await tx.verificationToken.deleteMany({ where: { userId: userUuid } });
      await tx.oAuthAccount.deleteMany({ where: { userId: userUuid } });
      await tx.userTwoFactor.deleteMany({ where: { userId: userUuid } });
      await tx.kycVerification.deleteMany({ where: { userId: userUuid } });

      // Pure user-owned content (safe to delete).
      await tx.cvDraft.deleteMany({ where: { userId: userUuid } });
      await tx.searchHistory.deleteMany({ where: { userId: userUuid } });
      await tx.jobAlert.deleteMany({ where: { userId: userUuid } });
      await tx.savedJob.deleteMany({ where: { userId: userUuid } });
      await tx.notification.deleteMany({ where: { userId: userUuid } });
      await tx.skillAssessmentSession.deleteMany({ where: { userId: userUuid } });

      // Applications + AI scores (keep rows for employer process history; strip PII).
      await tx.application.updateMany({
        where: { userId: userUuid },
        data: {
          coverLetter: null,
          resumeUrl: null,
          notes: null,
          portfolioUrl: null,
          screeningAnswers: Prisma.DbNull,
        },
      });
      await tx.candidateScore.updateMany({
        where: { userId: userUuid },
        data: { reasoning: null, rawAiResponse: Prisma.DbNull },
      });

      // Freelance bids keep commercial amounts; scrub narrative PII.
      await tx.bid.updateMany({
        where: { freelancerId: userUuid },
        data: { coverLetter: 'GDPR_SCRUBBED' },
      });

      // Freelance jobs posted by the user — scrub narrative/attachments; keep commercial fields.
      await tx.freelanceJob.updateMany({
        where: { clientId: userUuid },
        data: {
          title: '[Removed]',
          description: 'GDPR_SCRUBBED',
          attachments: [],
          locationPreference: null,
        },
      });

      // Escrow gateway webhooks may echo payer PII — strip known keys, keep transactional fields.
      const escrows = await tx.escrowTransaction.findMany({
        where: { freelanceJob: { clientId: userUuid }, gatewayResponse: { not: Prisma.DbNull } },
        select: { id: true, gatewayResponse: true },
      });
      for (const escrow of escrows) {
        await tx.escrowTransaction.update({
          where: { id: escrow.id },
          data: {
            gatewayResponse: this.scrubGatewayResponsePii(
              escrow.gatewayResponse,
            ) as Prisma.InputJsonValue,
          },
        });
      }

      // Disputes raised by the user (raisedById is a plain String, not a Prisma relation).
      await tx.dispute.updateMany({
        where: { raisedById: userUuid },
        data: {
          reason: 'GDPR_SCRUBBED',
          evidenceUrls: [],
        },
      });
      await tx.dispute.updateMany({
        where: { raisedById: userUuid, resolution: { not: null } },
        data: { resolution: 'GDPR_SCRUBBED' },
      });

      // Milestones + deliverables on contracts where the user is client or freelancer.
      const contracts = await tx.contract.findMany({
        where: { OR: [{ clientId: userUuid }, { freelancerId: userUuid }] },
        select: { id: true },
      });
      const contractIds = contracts.map((c) => c.id);
      if (contractIds.length > 0) {
        const milestones = await tx.milestone.findMany({
          where: { contractId: { in: contractIds } },
          select: { id: true },
        });
        const milestoneIds = milestones.map((m) => m.id);
        if (milestoneIds.length > 0) {
          await tx.milestone.updateMany({
            where: { id: { in: milestoneIds } },
            data: {
              title: '[Removed]',
              description: 'GDPR_SCRUBBED',
            },
          });
          await tx.deliverable.updateMany({
            where: { milestoneId: { in: milestoneIds } },
            data: {
              fileUrl: null,
              notes: 'GDPR_SCRUBBED',
            },
          });
        }
      }

      // Chat messages authored by the user.
      await tx.message.updateMany({
        where: { senderId: userUuid },
        data: { content: 'GDPR_SCRUBBED', metadata: Prisma.DbNull },
      });

      // ChatParticipant: no free-text PII to scrub. Membership linkage is mitigated at
      // read time by joining User (isActive=false + anonymized name/email after erasure).
      // No ChatParticipant write and no new schema flag — Contract/Referral left alone too.

      // Interview notes / meeting links involving the user.
      await tx.interview.updateMany({
        where: { OR: [{ candidateId: userUuid }, { employerId: userUuid }] },
        data: { notes: null, meetingLink: null },
      });

      // Video interview graph — strip media + transcripts; mark for retention cleanup.
      const videoInterviews = await tx.videoInterview.findMany({
        where: { userId: userUuid },
        select: { id: true },
      });
      const videoInterviewIds = videoInterviews.map((v) => v.id);
      if (videoInterviewIds.length > 0) {
        await tx.videoResponse.updateMany({
          where: { videoInterviewId: { in: videoInterviewIds } },
          data: {
            videoUrl: null,
            transcript: null,
            rawWhisperResponse: Prisma.DbNull,
          },
        });
        await tx.interviewEvaluation.updateMany({
          where: { videoInterviewId: { in: videoInterviewIds } },
          data: {
            scores: {},
            reasoning: null,
            rawAiResponse: Prisma.DbNull,
            gdprDeleteAt: new Date(scrubbedAt),
          },
        });
        await tx.videoInterview.updateMany({
          where: { id: { in: videoInterviewIds } },
          data: {
            metadata: {},
            gdprDeleteAt: new Date(scrubbedAt),
          },
        });
      }

      // Uploaded files — soft-delete + mask filename (object-store cleanup is separate).
      await tx.storedFile.updateMany({
        where: { uploadedById: userUuid, isDeleted: false },
        data: {
          isDeleted: true,
          deletedAt: new Date(scrubbedAt),
          filename: 'GDPR_SCRUBBED',
          hasConsentedToProcessing: false,
        },
      });

      // Company profile owned by the user + contact fields on their jobs.
      if (user.company) {
        await tx.company.update({
          where: { id: user.company.id },
          data: {
            name: 'GDPR_ANONYMOUS_COMPANY',
            description: null,
            logoUrl: null,
            website: null,
            coverImageUrl: null,
            facebookUrl: null,
            linkedinUrl: null,
            twitterUrl: null,
            location: null,
          },
        });
        await tx.job.updateMany({
          where: { companyId: user.company.id },
          data: {
            applyEmail: null,
            contactPhone: null,
            companyName: 'GDPR_ANONYMOUS_COMPANY',
            companyLogo: null,
          },
        });
      }

      // Subscription billing audit payloads (schema documents nulling these on erasure).
      const subscriptions = await tx.subscription.findMany({
        where: { userId: userUuid },
        select: { id: true },
      });
      if (subscriptions.length > 0) {
        await tx.subscriptionTransaction.updateMany({
          where: { subscriptionId: { in: subscriptions.map((s) => s.id) } },
          data: { rawPayload: Prisma.DbNull },
        });
      }

      if (user.wallet) {
        await tx.walletTransaction.updateMany({
          where: { walletId: user.wallet.id, note: { not: null } },
          data: { note: 'GDPR_SCRUBBED' },
        });
      }

      if (user.employerWallet) {
        await tx.employerWalletTransaction.updateMany({
          where: { walletId: user.employerWallet.id, note: { not: null } },
          data: { note: 'GDPR_SCRUBBED' },
        });
      }

      // Campaign / ad_events — delete telemetry (hashed IP/UA/session), complete campaigns.
      // Product rule is append-only for ops, but GDPR erasure is an explicit exception.
      const ownedCampaigns = await tx.campaign.findMany({
        where: { ownerId: userUuid },
        select: { id: true },
      });
      const campaignIds = ownedCampaigns.map((c) => c.id);
      if (campaignIds.length > 0) {
        await tx.adEvent.deleteMany({ where: { campaignId: { in: campaignIds } } });
        await tx.campaign.updateMany({
          where: { id: { in: campaignIds } },
          data: {
            status: 'COMPLETED',
            paymentTxRef: null,
            reservedAmountEtb: 0,
          },
        });
      }

      await tx.eventLog.create({
        data: {
          eventType: 'GDPR_DATA_ERASURE',
          entityId: userUuid,
          entityType: 'User',
          payload: {
            reason: audit.reason,
            actorUserId: audit.actorUserId,
            targetUserId: userUuid,
            referenceId,
            scrubbedAt,
          },
          processedBy: audit.actorUserId,
        },
      });
    });

    return { success: true, scrubbedAt, referenceId };
  }
}
