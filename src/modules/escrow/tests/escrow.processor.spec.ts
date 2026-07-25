import { Test, TestingModule } from '@nestjs/testing';
import { Job, Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { EscrowProcessor } from '../escrow.processor';
import { PrismaService } from '@prisma-client';
import { QUEUE_NAMES, ESCROW_JOBS, NOTIFICATION_JOBS } from '@modules/queues/queues.constants';

function mockQueue() {
  return { add: jest.fn().mockResolvedValue(undefined as any), name: QUEUE_NAMES.ESCROW } as any;
}

function buildJob(
  name: string,
  data: Record<string, unknown>,
  opts?: Record<string, unknown>,
): Job {
  return {
    id: 'test-job-id',
    name,
    data,
    opts: opts ?? {},
    attemptsMade: 0,
    timestamp: Date.now(),
  } as unknown as Job;
}

describe('EscrowProcessor', () => {
  let processor: EscrowProcessor;
  let prisma: any;
  let config: jest.Mocked<ConfigService>;
  let escrowQueue: any;
  let notificationsQueue: any;
  const mockI18nService = {
    t: jest.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key),
  };

  beforeEach(async () => {
    prisma = {
      escrowTransaction: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      freelanceJob: { update: jest.fn() },
      employerWallet: { findUnique: jest.fn(), update: jest.fn() },
      employerWalletTransaction: { create: jest.fn() },
      freelancerWallet: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
      walletTransaction: { create: jest.fn() },
      eventLog: { create: jest.fn() },
      milestone: { findUnique: jest.fn(), update: jest.fn() },
      contract: { findFirst: jest.fn(), update: jest.fn() },
      user: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    };

    config = {
      get: jest.fn((key: string) => {
        const map: Record<string, any> = {
          CHAPA_SECRET_KEY: 'test-chapa-secret',
          FRONTEND_URL: 'https://beleqet.com',
        };
        return map[key] ?? undefined;
      }),
    } as any;

    escrowQueue = mockQueue();
    notificationsQueue = mockQueue();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowProcessor,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: config },
        { provide: I18nService, useValue: mockI18nService },
        { provide: `BullQueue_${QUEUE_NAMES.ESCROW}`, useValue: escrowQueue },
        { provide: `BullQueue_${QUEUE_NAMES.NOTIFICATIONS}`, useValue: notificationsQueue },
      ],
    }).compile();

    processor = module.get<EscrowProcessor>(EscrowProcessor);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('process', () => {
    it('should route PROCESS_WEBHOOK to handleWebhook', async () => {
      const spy = jest.spyOn(processor, 'handleWebhook').mockResolvedValue(undefined);
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
      });
      await processor.process(job);
      expect(spy).toHaveBeenCalledWith(job);
    });

    it('should route AUTO_RELEASE to handleAutoRelease', async () => {
      const spy = jest.spyOn(processor, 'handleAutoRelease').mockResolvedValue(undefined);
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: new Date().toISOString(),
      });
      await processor.process(job);
      expect(spy).toHaveBeenCalledWith(job);
    });

    it('should route CANCEL_CHAPA_PAYMENT to handleCancelChapaPayment', async () => {
      const spy = jest.spyOn(processor, 'handleCancelChapaPayment').mockResolvedValue(undefined);
      const job = buildJob(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: 'e1',
        gatewayRef: 'gr1',
        clientId: 'c1',
      });
      await processor.process(job);
      expect(spy).toHaveBeenCalledWith(job);
    });

    it('should route UNLOCK_FUNDS to handleUnlockFunds', async () => {
      const spy = jest.spyOn(processor, 'handleUnlockFunds').mockResolvedValue(undefined);
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.process(job);
      expect(spy).toHaveBeenCalledWith(job);
    });

    it('should warn on unknown job name and not throw', async () => {
      const job = buildJob('unknown-job-type', {});
      await expect(processor.process(job)).resolves.toBeUndefined();
    });

    it('should log and re-throw when handler throws', async () => {
      const err = new Error('handler failure');
      jest.spyOn(processor, 'handleWebhook').mockRejectedValue(err);
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
      });
      job.attemptsMade = 1;
      await expect(processor.process(job)).rejects.toThrow(err);
    });
  });

  describe('handleWebhook', () => {
    it('should return early for invalid payload (missing fields)', async () => {
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: '',
        status: 'success',
        tx_ref: '',
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.findFirst).not.toHaveBeenCalled();
    });

    it('should return early for terminal status without timestamp (replay protection)', async () => {
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.findFirst).not.toHaveBeenCalled();
    });

    it('should return early for terminal status with invalid timestamp', async () => {
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'failure',
        tx_ref: 'tx1',
        timestamp: 'not-a-date',
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.findFirst).not.toHaveBeenCalled();
    });

    it('should return early for stale timestamp (>15 min old)', async () => {
      const stale = Date.now() - 20 * 60 * 1000;
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
        timestamp: stale,
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.findFirst).not.toHaveBeenCalled();
    });

    it('should allow pending status without timestamp', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({ id: 'e1', status: 'PENDING' });
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'pending',
        tx_ref: 'tx1',
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1' } }),
      );
    });

    it('should return early when escrow not found', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue(null);
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);
    });

    it('should skip if escrow is already FUNDED (idempotent)', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'FUNDED',
        freelanceJob: {},
      });
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.update).not.toHaveBeenCalled();
    });

    it('should handle pending status by updating gatewayResponse', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        freelanceJob: {},
      });
      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'pending',
        tx_ref: 'tx1',
      });
      await processor.handleWebhook(job);
      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith({
        where: { id: 'e1' },
        data: { gatewayResponse: job.data },
      });
    });

    it('should fund escrow on success with wallet applied amount', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        freelanceJobId: 'job1',
        walletAppliedAmount: 3000,
        grossAmount: 10000,
        freelanceJob: { clientId: 'c1', client: { id: 'c1' } },
        currency: 'ETB',
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));
      prisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1' });

      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);

      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: expect.objectContaining({ status: 'FUNDED' }),
        }),
      );
      expect(prisma.freelanceJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'job1' }, data: { status: 'FUNDED' } }),
      );
      expect(prisma.employerWallet.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'w1' },
          data: { lockedBalance: { decrement: 3000 } },
        }),
      );
      expect(prisma.employerWalletTransaction.create).toHaveBeenCalled();
      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ eventType: 'escrow.funded' }) }),
      );
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({
          userId: 'c1',
          type: 'escrow.funded',
        }),
      );
    });

    it('should fund escrow on success without wallet applied amount', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        freelanceJobId: 'job1',
        walletAppliedAmount: 0,
        grossAmount: 10000,
        freelanceJob: { clientId: 'c1', client: { id: 'c1' } },
        currency: 'ETB',
      });
      prisma.$transaction.mockImplementation(async (cb: any) => cb(prisma));

      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'success',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);

      expect(prisma.employerWallet.update).not.toHaveBeenCalled();
      expect(prisma.employerWalletTransaction.create).not.toHaveBeenCalled();
      expect(notificationsQueue.add).toHaveBeenCalled();
    });

    it('should set REFUNDED on failure and unlock wallet funds if applied', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        freelanceJobId: 'job1',
        walletAppliedAmount: 3000,
        grossAmount: 10000,
        freelanceJob: { clientId: 'c1' },
        currency: 'ETB',
      });
      prisma.employerWallet.findUnique.mockResolvedValue({ id: 'w1' });
      prisma.$transaction.mockResolvedValue([]);

      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'failure',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);

      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      expect(prisma.employerWallet.update).toHaveBeenCalled();
      expect(prisma.employerWalletTransaction.create).toHaveBeenCalled();
    });

    it('should set REFUNDED on failure without wallet amount', async () => {
      prisma.escrowTransaction.findFirst.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        freelanceJobId: 'job1',
        walletAppliedAmount: 0,
        grossAmount: 10000,
        freelanceJob: { clientId: 'c1' },
      });

      const job = buildJob(ESCROW_JOBS.PROCESS_WEBHOOK, {
        reference: 'r1',
        status: 'failure',
        tx_ref: 'tx1',
        timestamp: Date.now(),
      });
      await processor.handleWebhook(job);

      expect(prisma.escrowTransaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: expect.objectContaining({ status: 'REFUNDED' }),
        }),
      );
      expect(prisma.employerWallet.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('handleAutoRelease', () => {
    it('should return early for invalid payload', async () => {
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: '',
        freelancerId: 'f1',
        amount: 100,
        releaseAt: '',
      });
      await processor.handleAutoRelease(job);
      expect(prisma.milestone.findUnique).not.toHaveBeenCalled();
    });

    it('should return early for non-positive amount', async () => {
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 0,
        releaseAt: new Date().toISOString(),
      });
      await processor.handleAutoRelease(job);
      expect(prisma.milestone.findUnique).not.toHaveBeenCalled();
    });

    it('should re-queue with delay if hold period not elapsed', async () => {
      const future = new Date(Date.now() + 60_000).toISOString();
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: future,
      });
      await processor.handleAutoRelease(job);
      expect(escrowQueue.add).toHaveBeenCalledWith(
        ESCROW_JOBS.AUTO_RELEASE,
        job.data,
        expect.objectContaining({ delay: expect.any(Number) }),
      );
    });

    it('should skip if milestone not found', async () => {
      prisma.milestone.findUnique.mockResolvedValue(null);
      const past = new Date(Date.now() - 60_000).toISOString();
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await processor.handleAutoRelease(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if milestone not APPROVED', async () => {
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'SUBMITTED' });
      const past = new Date(Date.now() - 60_000).toISOString();
      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await processor.handleAutoRelease(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip milestone validation for admin force release', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { ...prisma };
        tx.freelancerWallet.findUnique = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 10000 });
        tx.freelancerWallet.update = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 5000, availableBalance: 5000 });
        return cb(tx);
      });
      prisma.user.findUnique.mockResolvedValue({ telegramId: null });

      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'admin-force:m1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await processor.handleAutoRelease(job);

      expect(prisma.milestone.findUnique).not.toHaveBeenCalled();
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({
          userId: 'f1',
          type: 'wallet.credited',
        }),
      );
    });

    it('should release funds and send telegram notification', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED' });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { ...prisma };
        tx.freelancerWallet.findUnique = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 10000 });
        tx.freelancerWallet.update = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 5000, availableBalance: 5000 });
        return cb(tx);
      });
      prisma.user.findUnique.mockResolvedValue({ id: 'f1', telegramId: '12345' });

      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await processor.handleAutoRelease(job);

      expect(prisma.walletTransaction.create).toHaveBeenCalled();
      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'wallet.credited' }),
        }),
      );
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({
          userId: 'f1',
          type: 'wallet.credited',
        }),
      );
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_TELEGRAM,
        expect.objectContaining({
          telegramId: '12345',
        }),
      );
    });

    it('should auto-complete contract when all milestones approved', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED' });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { ...prisma };
        tx.freelancerWallet.findUnique = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 10000 });
        tx.freelancerWallet.update = jest.fn().mockResolvedValue({ id: 'fw1' });
        tx.contract = { ...prisma.contract };
        return cb(tx);
      });
      prisma.user.findUnique.mockResolvedValue({ telegramId: null });

      prisma.contract.findFirst.mockResolvedValue({
        id: 'c1',
        status: 'ACTIVE',
        clientId: 'client1',
        freelancerId: 'f1',
        milestones: [{ status: 'APPROVED' }],
        freelanceJobId: 'job1',
        freelanceJob: { escrowTx: { id: 'e1', status: 'FUNDED' } },
      });

      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { ...prisma };
        tx.freelancerWallet.findUnique = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 10000 });
        tx.freelancerWallet.update = jest.fn().mockResolvedValue({ id: 'fw1' });
        tx.contract = { update: jest.fn(), ...prisma.contract };
        tx.escrowTransaction = { update: jest.fn(), ...prisma.escrowTransaction };
        tx.freelanceJob = { update: jest.fn(), ...prisma.freelanceJob };
        return cb(tx);
      });

      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await processor.handleAutoRelease(job);

      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({
          type: 'contract.completed',
        }),
      );
    });

    it('should throw on insufficient pending balance', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED' });
      prisma.$transaction.mockImplementation(async (cb: any) => {
        const tx = { ...prisma };
        tx.freelancerWallet.findUnique = jest
          .fn()
          .mockResolvedValue({ id: 'fw1', pendingBalance: 1000 });
        return cb(tx);
      });

      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await expect(processor.handleAutoRelease(job)).rejects.toThrow(
        'Insufficient pending balance',
      );
    });

    it('should re-throw unknown errors for BullMQ retry', async () => {
      const past = new Date(Date.now() - 60_000).toISOString();
      prisma.milestone.findUnique.mockResolvedValue({ id: 'm1', status: 'APPROVED' });
      prisma.$transaction.mockRejectedValue(new Error('db error'));

      const job = buildJob(ESCROW_JOBS.AUTO_RELEASE, {
        milestoneId: 'm1',
        freelancerId: 'f1',
        amount: 5000,
        releaseAt: past,
      });
      await expect(processor.handleAutoRelease(job)).rejects.toThrow('db error');
    });
  });

  describe('handleCancelChapaPayment', () => {
    beforeEach(() => {
      global.fetch = jest.fn();
    });

    it('should log manual intervention if CHAPA_SECRET_KEY missing', async () => {
      config.get.mockReturnValue(undefined);

      const job = buildJob(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: 'e1',
        gatewayRef: 'gr1',
        clientId: 'c1',
      });
      await processor.handleCancelChapaPayment(job);

      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'escrow.chapa-cancel-manual-intervention' }),
        }),
      );
    });

    it('should log success on Chapa API cancellation', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ status: 'success' }),
      });

      const job = buildJob(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: 'e1',
        gatewayRef: 'gr1',
        clientId: 'c1',
      });
      await processor.handleCancelChapaPayment(job);

      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'escrow.chapa-cancel-success' }),
        }),
      );
    });

    it('should log manual intervention on Chapa cancellation failure', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({ status: 'error', message: 'Cannot cancel' }),
      });

      const job = buildJob(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: 'e1',
        gatewayRef: 'gr1',
        clientId: 'c1',
      });
      await processor.handleCancelChapaPayment(job);

      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'escrow.chapa-cancel-manual-intervention' }),
        }),
      );
    });

    it('should log manual intervention on network error', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      const job = buildJob(ESCROW_JOBS.CANCEL_CHAPA_PAYMENT, {
        escrowId: 'e1',
        gatewayRef: 'gr1',
        clientId: 'c1',
      });
      await processor.handleCancelChapaPayment(job);

      expect(prisma.eventLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ eventType: 'escrow.chapa-cancel-manual-intervention' }),
        }),
      );
    });
  });

  describe('handleUnlockFunds', () => {
    it('should return early for invalid payload', async () => {
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, { escrowId: '', clientId: 'c1', amount: 100 });
      await processor.handleUnlockFunds(job);
      expect(prisma.escrowTransaction.findUnique).not.toHaveBeenCalled();
    });

    it('should return early for non-positive amount', async () => {
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, { escrowId: 'e1', clientId: 'c1', amount: 0 });
      await processor.handleUnlockFunds(job);
      expect(prisma.escrowTransaction.findUnique).not.toHaveBeenCalled();
    });

    it('should skip if escrow not found', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue(null);
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'missing',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.handleUnlockFunds(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if escrow status is not PENDING', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ id: 'e1', status: 'FUNDED' });
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.handleUnlockFunds(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if wallet not found', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDING' });
      prisma.employerWallet.findUnique.mockResolvedValue(null);
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.handleUnlockFunds(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should skip if locked balance insufficient', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({ id: 'e1', status: 'PENDING' });
      prisma.employerWallet.findUnique.mockResolvedValue({
        id: 'w1',
        lockedBalance: 1000,
        balance: 0,
      });
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.handleUnlockFunds(job);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('should unlock funds and send notification', async () => {
      prisma.escrowTransaction.findUnique.mockResolvedValue({
        id: 'e1',
        status: 'PENDING',
        currency: 'ETB',
      });
      prisma.employerWallet.findUnique.mockResolvedValue({
        id: 'w1',
        lockedBalance: 5000,
        balance: 0,
      });
      prisma.$transaction.mockResolvedValue([]);

      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await processor.handleUnlockFunds(job);

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(prisma.eventLog.create).toHaveBeenCalled();
      expect(notificationsQueue.add).toHaveBeenCalledWith(
        NOTIFICATION_JOBS.SEND_IN_APP,
        expect.objectContaining({
          userId: 'c1',
          type: 'wallet.unlocked',
        }),
      );
    });

    it('should re-throw errors for BullMQ retry', async () => {
      prisma.escrowTransaction.findUnique.mockRejectedValue(new Error('db error'));
      const job = buildJob(ESCROW_JOBS.UNLOCK_FUNDS, {
        escrowId: 'e1',
        clientId: 'c1',
        amount: 5000,
      });
      await expect(processor.handleUnlockFunds(job)).rejects.toThrow('db error');
    });
  });
});
