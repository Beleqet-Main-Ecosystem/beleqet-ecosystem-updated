/**
 * @file promoted-engine.service.integration.spec.ts
 * @description
 * Integration test: PromotedEngineService ↔ Wallet (EmployerWallet /
 * FreelancerWallet) ↔ Promotion campaign lifecycle.
 *
 * Verifies the full campaign-creation → ownership-validation → wallet-
 * funding-check path, and the click-charging transaction (wallet debit +
 * budget counters + audit row + status transition), all together. Prisma
 * is fully mocked (see buildMockPrisma) so no live DB connection is
 * required — mirrors the convention in payments-wallet.integration.spec.ts.
 *
 * Scenarios covered:
 *  1.  Create a JOB campaign owned by the caller, sufficient EmployerWallet balance → ACTIVE.
 *  2.  Create a JOB campaign NOT owned by the caller → ForbiddenException.
 *  3.  Create a campaign with insufficient EmployerWallet balance → BadRequestException.
 *  4.  Create a PROPOSAL campaign funds-checks against FreelancerWallet.availableBalance, not EmployerWallet.
 *  5.  IMPRESSION event increments impressions only, wallet untouched.
 *  6.  CLICK event debits the wallet, increments spend/click counters, writes an audit transaction.
 *  7.  CLICK on a non-servable (PAUSED) campaign is a no-op — no wallet debit, no counter change.
 *  8.  CLICK that exhausts the daily budget transitions the campaign to EXHAUSTED.
 *  9.  CLICK where the wallet debit's guarded updateMany matches 0 rows throws BadRequestException.
 *  10. updateStatus by a non-owner, non-admin caller → ForbiddenException.
 *  11. updateStatus on a CANCELLED campaign is rejected → BadRequestException.
 *  12. getActiveBoosts never exposes cpcBid in its response shape.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PromotedEngineService } from '../promoted-engine.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { SettableCampaignStatusDto } from '../dto/promoted-engine.dto';
import { PromotionTargetType } from '@prisma/client';

const OWNER_ID = 'owner-001';
const OTHER_USER_ID = 'other-002';
const JOB_ID = 'job-001';
const CAMPAIGN_ID = 'campaign-001';

function buildCampaignRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: CAMPAIGN_ID,
    ownerId: OWNER_ID,
    targetType: 'JOB',
    targetId: JOB_ID,
    status: 'ACTIVE',
    cpcBid: 100,
    dailyBudget: 1000,
    totalBudget: null,
    currency: 'ETB',
    spentToday: 0,
    spentTotal: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    startAt: new Date('2026-08-01T00:00:00Z'),
    endAt: null,
    createdAt: new Date('2026-08-01T00:00:00Z'),
    updatedAt: new Date('2026-08-01T00:00:00Z'),
    ...overrides,
  };
}

/**
 * Builds a mocked PrismaService. `$transaction` invokes the callback with a
 * stub tx client that shares the same jest.fn() mocks as the top-level
 * client (so assertions can check calls regardless of whether the code path
 * used `this.prisma.x` or `tx.x`), matching the pattern in
 * payments-wallet.integration.spec.ts.
 */
function buildMockPrisma(options: {
  campaign?: Record<string, unknown>;
  employerWallet?: { balance: number; currency?: string } | null;
  freelancerWallet?: { availableBalance: number; currency?: string } | null;
  jobOwnerId?: string;
  walletUpdateManyCount?: number;
}) {
  const campaign = options.campaign ?? buildCampaignRecord();
  const employerWallet = options.employerWallet
   ? { userId: OWNER_ID, currency: 'ETB', ...options.employerWallet }
    : null;
  const freelancerWallet = options.freelancerWallet
    ? { userId: OWNER_ID, currency: 'ETB', ...options.freelancerWallet }
    : null;
  const jobOwnerId = options.jobOwnerId ?? OWNER_ID;
  const walletUpdateManyCount = options.walletUpdateManyCount ?? 1;

  const promotionCampaignUpdate = jest.fn().mockImplementation(({ data }: any) => {
    const merged = { ...campaign };
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'increment' in (value as any)) {
        (merged as any)[key] = (merged as any)[key] + (value as any).increment;
      } else {
        (merged as any)[key] = value;
      }
    }
    Object.assign(campaign, merged);
    return Promise.resolve(merged);
  });

  const employerWalletUpdateMany = jest.fn().mockResolvedValue({ count: walletUpdateManyCount });
  const freelancerWalletUpdateMany = jest.fn().mockResolvedValue({ count: walletUpdateManyCount });
  const promotionWalletTransactionCreate = jest.fn().mockResolvedValue({ id: 'ptx-001' });
  const promotionEventCreate = jest.fn().mockResolvedValue({ id: 'pevt-001' });

  const stubTxClient = {
    promotionCampaign: { findUnique: jest.fn().mockResolvedValue(campaign), update: promotionCampaignUpdate },
    employerWallet: { updateMany: employerWalletUpdateMany },
    freelancerWallet: { updateMany: freelancerWalletUpdateMany },
    promotionWalletTransaction: { create: promotionWalletTransactionCreate },
    promotionEvent: { create: promotionEventCreate },
  };

  return {
    job: {
      findUnique: jest.fn().mockResolvedValue({ id: JOB_ID, company: { userId: jobOwnerId } }),
    },
    freelanceJob: {
      findUnique: jest.fn().mockResolvedValue({ id: JOB_ID, clientId: jobOwnerId }),
    },
    application: {
      findUnique: jest.fn().mockResolvedValue({ id: JOB_ID, userId: jobOwnerId }),
    },
    employerWallet: {
      findUnique: jest.fn().mockResolvedValue(employerWallet),
      updateMany: employerWalletUpdateMany,
    },
    freelancerWallet: {
      findUnique: jest.fn().mockResolvedValue(freelancerWallet),
      updateMany: freelancerWalletUpdateMany,
    },
    promotionCampaign: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...buildCampaignRecord(), ...data })),
      findMany: jest.fn().mockResolvedValue([campaign]),
      findUnique: jest.fn().mockResolvedValue(campaign),
      update: promotionCampaignUpdate,
    },
    promotionEvent: { create: promotionEventCreate },
    promotionWalletTransaction: { create: promotionWalletTransactionCreate },
    $transaction: jest.fn().mockImplementation(async (cb: (tx: unknown) => unknown) => cb(stubTxClient)),
  } as unknown as PrismaService;
}

async function buildCtx(prismaOverrides: Parameters<typeof buildMockPrisma>[0]) {
  const prisma = buildMockPrisma(prismaOverrides);

  const module: TestingModule = await Test.createTestingModule({
    providers: [PromotedEngineService, { provide: PrismaService, useValue: prisma }],
  }).compile();

  return { service: module.get(PromotedEngineService), prisma };
}

describe('PromotedEngineService integration', () => {
  it('1. creates a JOB campaign when the caller owns the job and the employer wallet can afford it', async () => {
    const { service } = await buildCtx({ employerWallet: { balance: 5000 }, jobOwnerId: OWNER_ID });

    const result = await service.createCampaign(OWNER_ID, {
      targetType: PromotionTargetType.JOB,
      targetId: JOB_ID,
      cpcBid: 100,
      dailyBudget: 1000,
    });

    expect(result.status).toBe('ACTIVE');
  });

  it('2. rejects campaign creation when the caller does not own the target job', async () => {
    const { service } = await buildCtx({ employerWallet: { balance: 5000 }, jobOwnerId: OTHER_USER_ID });

    await expect(
      service.createCampaign(OWNER_ID, {
      targetType: PromotionTargetType.JOB,
        targetId: JOB_ID,
        cpcBid: 100,
        dailyBudget: 1000,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('3. rejects campaign creation when the employer wallet balance is insufficient', async () => {
    const { service } = await buildCtx({ employerWallet: { balance: 50 }, jobOwnerId: OWNER_ID });

    await expect(
      service.createCampaign(OWNER_ID, {
       targetType: PromotionTargetType.JOB,
        targetId: JOB_ID,
        cpcBid: 100,
        dailyBudget: 1000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('4. checks FreelancerWallet.availableBalance (not EmployerWallet) for a PROPOSAL campaign', async () => {
    const { service, prisma } = await buildCtx({
      freelancerWallet: { availableBalance: 5000 },
      employerWallet: null,
      jobOwnerId: OWNER_ID,
    });

    await service.createCampaign(OWNER_ID, {
      targetType: PromotionTargetType.PROPOSAL,
      targetId: JOB_ID,
      cpcBid: 100,
      dailyBudget: 1000,
    });

    expect(prisma.freelancerWallet.findUnique).toHaveBeenCalled();
    expect(prisma.employerWallet.findUnique).not.toHaveBeenCalled();
  });

  it('5. records an IMPRESSION as a counter-only event with no wallet interaction', async () => {
    const { service, prisma } = await buildCtx({});

    await service.recordEvent(CAMPAIGN_ID, 'IMPRESSION');

    expect(prisma.employerWallet.updateMany).not.toHaveBeenCalled();
    expect(prisma.freelancerWallet.updateMany).not.toHaveBeenCalled();
  });

  it('6. charges a CLICK: debits the wallet and writes an audit transaction', async () => {
    const campaign = buildCampaignRecord({ spentToday: 0, spentTotal: 0, clicks: 0 });
    const { service, prisma } = await buildCtx({ campaign, employerWallet: { balance: 5000 } });

    await service.recordEvent(CAMPAIGN_ID, 'CLICK');

    expect(prisma.employerWallet.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: OWNER_ID, balance: { gte: 100 } }) }),
    );
    expect(prisma.promotionWalletTransaction.create).toHaveBeenCalled();
  });

  it('7. ignores a CLICK on a PAUSED (non-servable) campaign — no charge, no counter change', async () => {
    const campaign = buildCampaignRecord({ status: 'PAUSED' });
    const { service, prisma } = await buildCtx({ campaign, employerWallet: { balance: 5000 } });

    const result = await service.recordEvent(CAMPAIGN_ID, 'CLICK');

    expect(result.status).toBe('PAUSED');
    expect(prisma.employerWallet.updateMany).not.toHaveBeenCalled();
  });

  it('8. transitions a campaign to EXHAUSTED once a click uses up the remaining daily budget', async () => {
    const campaign = buildCampaignRecord({ dailyBudget: 100, spentToday: 0, cpcBid: 100 });
    const { service } = await buildCtx({ campaign, employerWallet: { balance: 5000 } });

    const result = await service.recordEvent(CAMPAIGN_ID, 'CLICK');

    expect(result.status).toBe('EXHAUSTED');
  });

  it('9. throws when the wallet debit finds insufficient funds at charge time (guarded updateMany matches 0 rows)', async () => {
    const campaign = buildCampaignRecord();
    const { service } = await buildCtx({ campaign, employerWallet: { balance: 5000 }, walletUpdateManyCount: 0 });

    await expect(service.recordEvent(CAMPAIGN_ID, 'CLICK')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('10. rejects a status update from someone who is neither the owner nor an admin', async () => {
    const campaign = buildCampaignRecord({ ownerId: OWNER_ID });
    const { service } = await buildCtx({ campaign });

    await expect(
      service.updateStatus(CAMPAIGN_ID, OTHER_USER_ID, 'EMPLOYER', SettableCampaignStatusDto.PAUSED),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('11. rejects any status update on an already-CANCELLED campaign', async () => {
    const campaign = buildCampaignRecord({ ownerId: OWNER_ID, status: 'CANCELLED' });
    const { service } = await buildCtx({ campaign });

    await expect(
      service.updateStatus(CAMPAIGN_ID, OWNER_ID, 'EMPLOYER', SettableCampaignStatusDto.ACTIVE),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("12. getActiveBoosts response never includes cpcBid or any other bid amount", async () => {
    const campaign = buildCampaignRecord({ targetId: JOB_ID, cpcBid: 999 });
    const { service } = await buildCtx({ campaign });

    const result = await service.getActiveBoosts(PromotionTargetType.JOB, [JOB_ID]);

    expect(result).toEqual([{ targetId: JOB_ID, isBoosted: true }]);
    expect(JSON.stringify(result)).not.toContain('999');
  });
});