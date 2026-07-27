import { Test, TestingModule } from '@nestjs/testing';
import { EscrowService } from './escrow.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';
import { getQueueToken } from '@nestjs/bullmq';
import { QUEUE_NAMES, ESCROW_JOBS } from '../queues/queues.constants';
import { NotFoundException } from '@nestjs/common';

import { EventEmitter2 } from '@nestjs/event-emitter';

describe('EscrowService', () => {
  let service: EscrowService;
  let prismaService: any;
  let walletService: any;
  let escrowQueue: any;

  beforeEach(async () => {
    prismaService = {
      milestone: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prismaService)),
      eventLog: {
        create: jest.fn(),
      },
      freelancerWallet: {
        upsert: jest.fn(),
      },
    };

    walletService = {
      convertCurrency: jest.fn((amount: number) => amount),
    };

    escrowQueue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscrowService,
        { provide: PrismaService, useValue: prismaService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: WalletService, useValue: walletService },
        { provide: getQueueToken(QUEUE_NAMES.ESCROW), useValue: escrowQueue },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<EscrowService>(EscrowService);
  });

  it('should throw NotFoundException if milestone is not found', async () => {
    prismaService.milestone.findFirst.mockResolvedValue(null);
    await expect(service.releaseMilestone('m1', 'client1')).rejects.toThrow(NotFoundException);
  });

  it('should approve milestone and deduct 10% platform fee before crediting freelancer wallet', async () => {
    const mockMilestone = {
      id: 'm100',
      amount: 1000,
      contract: {
        clientId: 'client1',
        freelancerId: 'freelancer1',
        currency: 'ETB',
      },
    };

    prismaService.milestone.findFirst.mockResolvedValue(mockMilestone);

    const result = await service.releaseMilestone('m100', 'client1');

    expect(result).toEqual({ success: true });
    expect(prismaService.milestone.update).toHaveBeenCalledWith({
      where: { id: 'm100' },
      data: expect.objectContaining({ status: 'APPROVED' }),
    });

    // 1000 ETB gross -> 100 ETB (10%) platform fee -> 900 ETB net credited to freelancer wallet
    expect(prismaService.freelancerWallet.upsert).toHaveBeenCalledWith({
      where: { userId: 'freelancer1' },
      update: { pendingBalance: { increment: 900 } },
      create: {
        userId: 'freelancer1',
        pendingBalance: 900,
        availableBalance: 0,
      },
    });

    expect(escrowQueue.add).toHaveBeenCalledWith(
      ESCROW_JOBS.AUTO_RELEASE,
      expect.objectContaining({
        milestoneId: 'm100',
        freelancerId: 'freelancer1',
        amount: 900,
      }),
    );
  });
});
