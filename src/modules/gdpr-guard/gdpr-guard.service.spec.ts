import { Test, TestingModule } from '@nestjs/testing';
import { GdprGuardService } from './gdpr-guard.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockTx = {
  user: { update: jest.fn() },
  contactMessage: { updateMany: jest.fn() },
  refreshToken: { deleteMany: jest.fn() },
  verificationToken: { deleteMany: jest.fn() },
  oAuthAccount: { deleteMany: jest.fn() },
  userTwoFactor: { deleteMany: jest.fn() },
  kycVerification: { deleteMany: jest.fn() },
  cvDraft: { deleteMany: jest.fn() },
  searchHistory: { deleteMany: jest.fn() },
  jobAlert: { deleteMany: jest.fn() },
  savedJob: { deleteMany: jest.fn() },
  notification: { deleteMany: jest.fn() },
  skillAssessmentSession: { deleteMany: jest.fn() },
  application: { updateMany: jest.fn() },
  candidateScore: { updateMany: jest.fn() },
  bid: { updateMany: jest.fn() },
  freelanceJob: { updateMany: jest.fn() },
  escrowTransaction: {
    findMany: jest.fn().mockResolvedValue([]),
    update: jest.fn(),
  },
  dispute: { updateMany: jest.fn() },
  contract: { findMany: jest.fn().mockResolvedValue([]) },
  milestone: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
  deliverable: { updateMany: jest.fn() },
  message: { updateMany: jest.fn() },
  interview: { updateMany: jest.fn() },
  videoInterview: { findMany: jest.fn().mockResolvedValue([]), updateMany: jest.fn() },
  videoResponse: { updateMany: jest.fn() },
  interviewEvaluation: { updateMany: jest.fn() },
  storedFile: { updateMany: jest.fn() },
  company: { update: jest.fn() },
  job: { updateMany: jest.fn() },
  subscription: { findMany: jest.fn().mockResolvedValue([]) },
  subscriptionTransaction: { updateMany: jest.fn() },
  walletTransaction: { updateMany: jest.fn() },
  employerWalletTransaction: { updateMany: jest.fn() },
  eventLog: { create: jest.fn() },
};

const mockPrismaService = {
  user: { findUnique: jest.fn() },
  $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<void>) => cb(mockTx)),
};

describe('GdprGuardService', () => {
  let service: GdprGuardService;

  const audit = {
    reason: 'User requested account deletion under GDPR Article 17',
    actorUserId: 'admin-uuid-0000-0000-0000-000000000001',
  };

  beforeEach(async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const module: TestingModule = await Test.createTestingModule({
      providers: [GdprGuardService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();

    service = module.get<GdprGuardService>(GdprGuardService);
    jest.clearAllMocks();
    mockTx.videoInterview.findMany.mockResolvedValue([]);
    mockTx.subscription.findMany.mockResolvedValue([]);
    mockTx.contract.findMany.mockResolvedValue([]);
    mockTx.milestone.findMany.mockResolvedValue([]);
    mockTx.escrowTransaction.findMany.mockResolvedValue([]);
  });

  it('should be defined and instantiate properly', () => {
    expect(service).toBeDefined();
  });

  describe('PII Cryptography', () => {
    it('should successfully encrypt and decrypt raw text using AES-256-GCM', () => {
      const rawText = 'Bemnet Derseh Ayalew';
      const encrypted = service.encryptPii(rawText);

      expect(encrypted).not.toEqual(rawText);
      expect(encrypted.split(':').length).toEqual(3);
      expect(service.decryptPii(encrypted)).toEqual(rawText);
    });

    it('should return empty/falsy values directly without error', () => {
      expect(service.encryptPii('')).toEqual('');
      expect(service.decryptPii('')).toEqual('');
    });
  });

  describe('executeDataErasure', () => {
    const mockUuid = '123e4567-e89b-12d3-a456-426614174000';

    it('should scrub user + related-model PII without relying on Cascade deletes', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue({
        id: mockUuid,
        email: 'test@example.com',
        wallet: { id: 'wallet-1' },
        employerWallet: { id: 'employer-wallet-1' },
        company: { id: 'company-1' },
      });
      mockTx.videoInterview.findMany.mockResolvedValue([{ id: 'vi-1' }]);
      mockTx.subscription.findMany.mockResolvedValue([{ id: 'sub-1' }]);
      mockTx.contract.findMany.mockResolvedValue([{ id: 'contract-1' }]);
      mockTx.milestone.findMany.mockResolvedValue([{ id: 'milestone-1' }]);
      mockTx.escrowTransaction.findMany.mockResolvedValue([
        {
          id: 'escrow-1',
          gatewayResponse: {
            event: 'charge.success',
            status: 'success',
            amount: '400.00',
            currency: 'ETB',
            reference: 'AP634JFwEbxd',
            tx_ref: '4FGFF4FFGD3',
            first_name: 'Bemnet',
            last_name: 'Test',
            email: 'test@example.com',
            mobile: '25190000000',
            data: {
              account_name: 'Bemnet Test',
              account_number: '251911111111',
              status: 'success',
            },
          },
        },
      ]);

      const result = await service.executeDataErasure(mockUuid, audit);

      expect(result.success).toBe(true);
      expect(result.referenceId).toBeDefined();
      expect(result.scrubbedAt).toBeDefined();

      expect(mockTx.contactMessage.updateMany).toHaveBeenCalledWith({
        where: { email: 'test@example.com' },
        data: expect.objectContaining({
          name: 'GDPR_ANONYMOUS',
          message: 'GDPR_SCRUBBED',
        }),
      });
      expect(mockTx.user.update).toHaveBeenCalledWith({
        where: { id: mockUuid },
        data: expect.objectContaining({
          firstName: 'GDPR_ANONYMOUS',
          lastName: 'USER',
          phone: null,
          avatarUrl: null,
          telegramId: null,
          bio: null,
          skills: [],
          isActive: false,
          gdprConsent: false,
          kycVerified: false,
          skillVerified: false,
        }),
      });

      // Explicit deletes (Cascade never fires when the User row is retained).
      expect(mockTx.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.verificationToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.oAuthAccount.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.userTwoFactor.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.kycVerification.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.cvDraft.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUuid } });
      expect(mockTx.searchHistory.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.jobAlert.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUuid } });
      expect(mockTx.savedJob.deleteMany).toHaveBeenCalledWith({ where: { userId: mockUuid } });
      expect(mockTx.notification.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });
      expect(mockTx.skillAssessmentSession.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
      });

      expect(mockTx.application.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
        data: expect.objectContaining({
          coverLetter: null,
          resumeUrl: null,
          notes: null,
          portfolioUrl: null,
        }),
      });
      expect(mockTx.candidateScore.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUuid },
        data: expect.objectContaining({ reasoning: null }),
      });
      expect(mockTx.bid.updateMany).toHaveBeenCalledWith({
        where: { freelancerId: mockUuid },
        data: { coverLetter: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.freelanceJob.updateMany).toHaveBeenCalledWith({
        where: { clientId: mockUuid },
        data: {
          title: '[Removed]',
          description: 'GDPR_SCRUBBED',
          attachments: [],
          locationPreference: null,
        },
      });
      expect(mockTx.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'escrow-1' },
        data: {
          gatewayResponse: {
            event: 'charge.success',
            status: 'success',
            amount: '400.00',
            currency: 'ETB',
            reference: 'AP634JFwEbxd',
            tx_ref: '4FGFF4FFGD3',
            data: {
              status: 'success',
            },
          },
        },
      });
      expect(mockTx.dispute.updateMany).toHaveBeenCalledWith({
        where: { raisedById: mockUuid },
        data: {
          reason: 'GDPR_SCRUBBED',
          evidenceUrls: [],
        },
      });
      expect(mockTx.dispute.updateMany).toHaveBeenCalledWith({
        where: { raisedById: mockUuid, resolution: { not: null } },
        data: { resolution: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.contract.findMany).toHaveBeenCalledWith({
        where: { OR: [{ clientId: mockUuid }, { freelancerId: mockUuid }] },
        select: { id: true },
      });
      expect(mockTx.milestone.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['milestone-1'] } },
        data: {
          title: '[Removed]',
          description: 'GDPR_SCRUBBED',
        },
      });
      expect(mockTx.deliverable.updateMany).toHaveBeenCalledWith({
        where: { milestoneId: { in: ['milestone-1'] } },
        data: {
          fileUrl: null,
          notes: 'GDPR_SCRUBBED',
        },
      });
      expect(mockTx.message.updateMany).toHaveBeenCalledWith({
        where: { senderId: mockUuid },
        data: expect.objectContaining({ content: 'GDPR_SCRUBBED' }),
      });
      expect(mockTx.interview.updateMany).toHaveBeenCalledWith({
        where: { OR: [{ candidateId: mockUuid }, { employerId: mockUuid }] },
        data: { notes: null, meetingLink: null },
      });
      expect(mockTx.videoResponse.updateMany).toHaveBeenCalledWith({
        where: { videoInterviewId: { in: ['vi-1'] } },
        data: expect.objectContaining({
          videoUrl: null,
          transcript: null,
        }),
      });
      expect(mockTx.interviewEvaluation.updateMany).toHaveBeenCalled();
      expect(mockTx.videoInterview.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['vi-1'] } },
        data: expect.objectContaining({ metadata: {} }),
      });
      expect(mockTx.storedFile.updateMany).toHaveBeenCalledWith({
        where: { uploadedById: mockUuid, isDeleted: false },
        data: expect.objectContaining({
          isDeleted: true,
          filename: 'GDPR_SCRUBBED',
        }),
      });
      expect(mockTx.company.update).toHaveBeenCalledWith({
        where: { id: 'company-1' },
        data: expect.objectContaining({ name: 'GDPR_ANONYMOUS_COMPANY' }),
      });
      expect(mockTx.job.updateMany).toHaveBeenCalledWith({
        where: { companyId: 'company-1' },
        data: expect.objectContaining({
          applyEmail: null,
          contactPhone: null,
        }),
      });
      expect(mockTx.subscriptionTransaction.updateMany).toHaveBeenCalledWith({
        where: { subscriptionId: { in: ['sub-1'] } },
        data: expect.objectContaining({ rawPayload: expect.anything() }),
      });
      expect(mockTx.walletTransaction.updateMany).toHaveBeenCalledWith({
        where: { walletId: 'wallet-1', note: { not: null } },
        data: { note: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.employerWalletTransaction.updateMany).toHaveBeenCalledWith({
        where: { walletId: 'employer-wallet-1', note: { not: null } },
        data: { note: 'GDPR_SCRUBBED' },
      });
      expect(mockTx.eventLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventType: 'GDPR_DATA_ERASURE',
          entityId: mockUuid,
          entityType: 'User',
          processedBy: audit.actorUserId,
          payload: expect.objectContaining({
            reason: audit.reason,
            actorUserId: audit.actorUserId,
            targetUserId: mockUuid,
            referenceId: result.referenceId,
            scrubbedAt: result.scrubbedAt,
          }),
        }),
      });
    });

    it('should throw NotFoundException if the user does not exist', async () => {
      mockPrismaService.user.findUnique.mockResolvedValue(null);

      await expect(service.executeDataErasure(mockUuid, audit)).rejects.toThrow(NotFoundException);
      expect(mockPrismaService.$transaction).not.toHaveBeenCalled();
    });
  });
});
