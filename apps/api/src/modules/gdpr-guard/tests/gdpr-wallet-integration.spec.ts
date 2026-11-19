import { describe, beforeAll, afterAll, it, expect } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../../../prisma/prisma.service';
import { PrismaModule } from '../../../prisma/prisma.module';
import { GdprGuardService } from '../gdpr-guard.service';
import { GdprGuardModule } from '../gdpr-guard.module';
import { RedisModule } from '../../redis/redis.module';

describe('GDPR Guard & Wallet Integration Test', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let gdprService: GdprGuardService;
  // Ids of everything this test creates, so cleanup removes exactly that and nothing else.
  const created: Record<string, string> = {};

  const audit = {
    reason: 'Integration test GDPR erasure',
    actorUserId: '00000000-0000-4000-8000-000000000099',
  };

  beforeAll(async () => {
    process.env.GDPR_ENCRYPTION_KEY =
      '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
        RedisModule,
        GdprGuardModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get<PrismaService>(PrismaService);
    gdprService = moduleFixture.get<GdprGuardService>(GdprGuardService);
  }, 30000);

  afterAll(async () => {
    // This used to TRUNCATE users CASCADE, which emptied every user-linked table of whatever
    // database the test ran against, and still left the test's freelance category behind.
    // Never pass undefined to a filter: Prisma treats it as "no filter" and would delete every row.
    const only = (id?: string) => (id ? [id] : []);
    const userIds = [created.user, created.counterparty].filter(Boolean);
    await prisma.$transaction([
      prisma.deliverable.deleteMany({ where: { id: { in: only(created.deliverable) } } }),
      prisma.milestone.deleteMany({ where: { id: { in: only(created.milestone) } } }),
      prisma.dispute.deleteMany({ where: { id: { in: only(created.dispute) } } }),
      prisma.chatParticipant.deleteMany({ where: { roomId: { in: only(created.chatRoom) } } }),
      prisma.chatRoom.deleteMany({ where: { id: { in: only(created.chatRoom) } } }),
      prisma.walletTransaction.deleteMany({ where: { walletId: { in: only(created.wallet) } } }),
      prisma.freelancerWallet.deleteMany({ where: { id: { in: only(created.wallet) } } }),
      prisma.contract.deleteMany({ where: { id: { in: only(created.contract) } } }),
      prisma.escrowTransaction.deleteMany({ where: { id: { in: only(created.escrow) } } }),
      prisma.freelanceJob.deleteMany({ where: { id: { in: only(created.freelanceJob) } } }),
      prisma.freelanceCategory.deleteMany({ where: { id: { in: only(created.category) } } }),
      prisma.contactMessage.deleteMany({ where: { id: { in: only(created.contact) } } }),
      prisma.searchHistory.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.cvDraft.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.oAuthAccount.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }),
      prisma.user.deleteMany({ where: { id: { in: userIds } } }),
    ]);
    await app.close();
  }, 30000);

  it('should scrub user PII and wallet transaction notes while preserving ledger balances', async () => {
    const testUser = await prisma.user.create({
      data: {
        email: 'integration-test@beleqet.com',
        firstName: 'Bemnet',
        lastName: 'Test',
        passwordHash: 'hashed_password_here',
        phone: '+251912345678',
        bio: 'Software engineer in Addis Ababa',
        headline: 'Full-stack developer',
        location: 'Addis Ababa, Ethiopia',
        githubUrl: 'https://github.com/bemnet-test',
        linkedinUrl: 'https://linkedin.com/in/bemnet-test',
        skills: ['TypeScript', 'NestJS'],
      },
    });
    created.user = testUser.id;

    await prisma.refreshToken.create({
      data: {
        userId: testUser.id,
        token: 'active-session-token',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });

    await prisma.oAuthAccount.create({
      data: {
        userId: testUser.id,
        provider: 'GOOGLE',
        providerAccountId: 'google-sub-integration-test',
        encryptedAccessToken: 'enc-access-token',
        encryptedRefreshToken: 'enc-refresh-token',
      },
    });

    await prisma.cvDraft.create({
      data: {
        userId: testUser.id,
        data: { fullName: 'Bemnet Test', email: 'integration-test@beleqet.com' },
      },
    });

    await prisma.searchHistory.create({
      data: { userId: testUser.id, searchTerm: 'NestJS developer Addis' },
    });

    const contactMessage = await prisma.contactMessage.create({
      data: {
        name: 'Bemnet Test',
        email: 'integration-test@beleqet.com',
        subject: 'Help with account',
        message: 'Please delete my personal data',
      },
    });
    created.contact = contactMessage.id;

    const category = await prisma.freelanceCategory.create({
      data: { slug: `gdpr-test-${Date.now()}`, label: 'GDPR Test Category' },
    });
    created.category = category.id;

    const freelanceJob = await prisma.freelanceJob.create({
      data: {
        title: 'Need NestJS help — call Bemnet at +251912345678',
        description: 'Contact me at integration-test@beleqet.com for details',
        categoryId: category.id,
        clientId: testUser.id,
        budgetMin: 1000,
        budgetMax: 5000,
        deadlineDays: 14,
        skills: ['NestJS'],
        attachments: ['https://files.example.com/bemnet-brief.pdf'],
        locationPreference: 'Addis Ababa',
      },
    });
    created.freelanceJob = freelanceJob.id;

    const escrow = await prisma.escrowTransaction.create({
      data: {
        freelanceJobId: freelanceJob.id,
        grossAmount: 5000,
        platformFee: 500,
        netAmount: 4500,
        currency: 'ETB',
        status: 'FUNDED',
        gatewayRef: 'ESCROW-TX-REF-GDPR',
        gatewayResponse: {
          event: 'charge.success',
          status: 'success',
          amount: '5000.00',
          currency: 'ETB',
          reference: 'CHAPA-REF-GDPR',
          tx_ref: 'ESCROW-TX-REF-GDPR',
          first_name: 'Bemnet',
          last_name: 'Test',
          email: 'integration-test@beleqet.com',
          mobile: '251912345678',
          data: {
            account_name: 'Bemnet Test',
            account_number: '251912345678',
            chapa_reference: '2o10dfs332U',
            status: 'success',
          },
        },
      },
    });
    created.escrow = escrow.id;

    const counterparty = await prisma.user.create({
      data: {
        email: 'counterparty@beleqet.com',
        firstName: 'Other',
        lastName: 'Party',
        passwordHash: 'hashed',
      },
    });
    created.counterparty = counterparty.id;

    const contract = await prisma.contract.create({
      data: {
        freelanceJobId: freelanceJob.id,
        clientId: testUser.id,
        freelancerId: counterparty.id,
        agreedAmount: 3000,
      },
    });
    created.contract = contract.id;

    const dispute = await prisma.dispute.create({
      data: {
        contractId: contract.id,
        raisedById: testUser.id,
        reason: 'Freelancer has my home address and phone number',
        evidenceUrls: ['https://files.example.com/evidence-id-scan.png'],
        resolution: 'Settled offline with Bemnet Test',
      },
    });
    created.dispute = dispute.id;

    const milestone = await prisma.milestone.create({
      data: {
        contractId: contract.id,
        title: 'Milestone 1 — deliver resume for Bemnet',
        description: 'Include Bemnet Test phone +251912345678 in the package',
        amount: 1500,
        deadline: new Date(Date.now() + 7 * 86_400_000),
      },
    });
    created.milestone = milestone.id;

    const deliverable = await prisma.deliverable.create({
      data: {
        milestoneId: milestone.id,
        fileUrl: 'https://files.example.com/bemnet-deliverable.pdf',
        notes: 'File contains Bemnet Test passport scan',
      },
    });
    created.deliverable = deliverable.id;

    const chatRoom = await prisma.chatRoom.create({
      data: { contractId: contract.id },
    });
    created.chatRoom = chatRoom.id;
    await prisma.chatParticipant.create({
      data: { roomId: chatRoom.id, userId: testUser.id },
    });

    const wallet = await prisma.freelancerWallet.create({
      data: {
        userId: testUser.id,
        availableBalance: 5000,
        pendingBalance: 150,
        currency: 'ETB',
      },
    });
    created.wallet = wallet.id;

    await prisma.walletTransaction.createMany({
      data: [
        {
          walletId: wallet.id,
          amount: 1000,
          type: 'CREDIT_PENDING',
          note: 'Deposit from Bemnet Test - account ending 4521',
        },
        {
          walletId: wallet.id,
          amount: 50,
          type: 'DEBIT_WITHDRAWAL',
          note: 'Withdrawal to beleqet-test@bank.com',
        },
      ],
    });

    const result = await gdprService.executeDataErasure(testUser.id, audit);

    const updatedWallet = await prisma.freelancerWallet.findUnique({
      where: { id: wallet.id },
    });
    expect(updatedWallet).not.toBeNull();
    expect(updatedWallet!.availableBalance).toBe(5000);
    expect(updatedWallet!.pendingBalance).toBe(150);

    const remainingTransactions = await prisma.walletTransaction.findMany({
      where: { walletId: wallet.id },
    });
    expect(remainingTransactions.length).toBe(2);
    expect(remainingTransactions.every((tx) => tx.note === 'GDPR_SCRUBBED')).toBe(true);

    const updatedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.email).not.toBe('integration-test@beleqet.com');
    expect(updatedUser!.firstName).toBe('GDPR_ANONYMOUS');
    expect(updatedUser!.lastName).toBe('USER');
    expect(updatedUser!.phone).toBeNull();
    expect(updatedUser!.bio).toBeNull();
    expect(updatedUser!.headline).toBeNull();
    expect(updatedUser!.location).toBeNull();
    expect(updatedUser!.githubUrl).toBeNull();
    expect(updatedUser!.linkedinUrl).toBeNull();
    expect(updatedUser!.skills).toEqual([]);
    expect(updatedUser!.isActive).toBe(false);
    expect(updatedUser!.passwordHash).not.toBe('hashed_password_here');

    const remainingTokens = await prisma.refreshToken.count({
      where: { userId: testUser.id },
    });
    expect(remainingTokens).toBe(0);

    // Related models must be scrubbed/deleted explicitly (Cascade never fires).
    expect(await prisma.oAuthAccount.count({ where: { userId: testUser.id } })).toBe(0);
    expect(await prisma.cvDraft.count({ where: { userId: testUser.id } })).toBe(0);
    expect(await prisma.searchHistory.count({ where: { userId: testUser.id } })).toBe(0);

    const contact = await prisma.contactMessage.findFirst({
      where: { email: updatedUser!.email },
    });
    expect(contact).not.toBeNull();
    expect(contact!.name).toBe('GDPR_ANONYMOUS');
    expect(contact!.message).toBe('GDPR_SCRUBBED');

    const scrubbedJob = await prisma.freelanceJob.findUnique({ where: { id: freelanceJob.id } });
    expect(scrubbedJob).not.toBeNull();
    expect(scrubbedJob!.title).toBe('[Removed]');
    expect(scrubbedJob!.description).toBe('GDPR_SCRUBBED');
    expect(scrubbedJob!.attachments).toEqual([]);
    expect(scrubbedJob!.locationPreference).toBeNull();
    expect(scrubbedJob!.clientId).toBe(testUser.id);
    expect(scrubbedJob!.budgetMin).toBe(1000);
    expect(scrubbedJob!.budgetMax).toBe(5000);

    const scrubbedEscrow = await prisma.escrowTransaction.findUnique({ where: { id: escrow.id } });
    expect(scrubbedEscrow).not.toBeNull();
    expect(scrubbedEscrow!.gatewayRef).toBe('ESCROW-TX-REF-GDPR');
    expect(scrubbedEscrow!.grossAmount).toBe(5000);
    const gw = scrubbedEscrow!.gatewayResponse as Record<string, unknown>;
    expect(gw.status).toBe('success');
    expect(gw.amount).toBe('5000.00');
    expect(gw.currency).toBe('ETB');
    expect(gw.reference).toBe('CHAPA-REF-GDPR');
    expect(gw).not.toHaveProperty('first_name');
    expect(gw).not.toHaveProperty('last_name');
    expect(gw).not.toHaveProperty('email');
    expect(gw).not.toHaveProperty('mobile');
    const nested = gw.data as Record<string, unknown>;
    expect(nested.status).toBe('success');
    expect(nested.chapa_reference).toBe('2o10dfs332U');
    expect(nested).not.toHaveProperty('account_name');
    expect(nested).not.toHaveProperty('account_number');

    const scrubbedDispute = await prisma.dispute.findUnique({ where: { id: dispute.id } });
    expect(scrubbedDispute).not.toBeNull();
    expect(scrubbedDispute!.reason).toBe('GDPR_SCRUBBED');
    expect(scrubbedDispute!.resolution).toBe('GDPR_SCRUBBED');
    expect(scrubbedDispute!.evidenceUrls).toEqual([]);
    expect(scrubbedDispute!.raisedById).toBe(testUser.id);
    expect(scrubbedDispute!.contractId).toBe(contract.id);

    const scrubbedMilestone = await prisma.milestone.findUnique({ where: { id: milestone.id } });
    expect(scrubbedMilestone).not.toBeNull();
    expect(scrubbedMilestone!.title).toBe('[Removed]');
    expect(scrubbedMilestone!.description).toBe('GDPR_SCRUBBED');
    expect(scrubbedMilestone!.amount).toBe(1500);
    expect(scrubbedMilestone!.contractId).toBe(contract.id);

    const scrubbedDeliverable = await prisma.deliverable.findUnique({
      where: { id: deliverable.id },
    });
    expect(scrubbedDeliverable).not.toBeNull();
    expect(scrubbedDeliverable!.fileUrl).toBeNull();
    expect(scrubbedDeliverable!.notes).toBe('GDPR_SCRUBBED');
    expect(scrubbedDeliverable!.milestoneId).toBe(milestone.id);

    // ChatParticipant kept (room integrity); identity anonymized via User join.
    const participant = await prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId: chatRoom.id, userId: testUser.id } },
      include: { user: true },
    });
    expect(participant).not.toBeNull();
    expect(participant!.user.isActive).toBe(false);
    expect(participant!.user.firstName).toBe('GDPR_ANONYMOUS');

    const auditLog = await prisma.eventLog.findFirst({
      where: {
        eventType: 'GDPR_DATA_ERASURE',
        entityId: testUser.id,
      },
    });
    expect(auditLog).not.toBeNull();
    expect(auditLog!.processedBy).toBe(audit.actorUserId);
    expect(auditLog!.payload).toMatchObject({
      reason: audit.reason,
      actorUserId: audit.actorUserId,
      targetUserId: testUser.id,
      referenceId: result.referenceId,
      scrubbedAt: result.scrubbedAt,
    });
  });
});
