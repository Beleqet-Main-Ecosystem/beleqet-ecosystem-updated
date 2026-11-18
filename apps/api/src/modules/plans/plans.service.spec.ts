import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PlansService } from './plans.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('PlansService', () => {
  let service: PlansService;
  let prisma: {
    plan: {
      findMany: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      plan: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [PlansService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = module.get<PlansService>(PlansService);
  });

  describe('findAll', () => {
    it('filters to active plans by default', async () => {
      prisma.plan.findMany.mockResolvedValue([]);
      await service.findAll();
      expect(prisma.plan.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it('includes inactive plans when requested (admin view)', async () => {
      prisma.plan.findMany.mockResolvedValue([]);
      await service.findAll(true);
      expect(prisma.plan.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
    });
  });

  describe('findOne', () => {
    it('returns the plan when found', async () => {
      const plan = { id: 'p1', name: 'Pro' };
      prisma.plan.findUnique.mockResolvedValue(plan);
      await expect(service.findOne('p1')).resolves.toEqual(plan);
    });

    it('throws NotFoundException when missing', async () => {
      prisma.plan.findUnique.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    const dto = {
      name: 'Pro',
      priceAmount: 99900,
      features: { maxJobPosts: 5 },
    };

    it('creates a plan with ETB default currency and MONTHLY interval', async () => {
      prisma.plan.create.mockResolvedValue({ id: 'p1', ...dto });
      await service.create(dto as never);
      expect(prisma.plan.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ currency: 'ETB', isActive: true }),
        }),
      );
    });

    it('translates a unique-constraint violation into ConflictException', async () => {
      prisma.plan.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('duplicate', {
          code: 'P2002',
          clientVersion: '5.22.0',
        }),
      );
      await expect(service.create(dto as never)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('soft-deletes by setting isActive=false instead of destroying the row', async () => {
      prisma.plan.findUnique.mockResolvedValue({ id: 'p1' });
      prisma.plan.update.mockResolvedValue({ id: 'p1', isActive: false });
      await service.remove('p1');
      expect(prisma.plan.update).toHaveBeenCalledWith({
        where: { id: 'p1' },
        data: { isActive: false },
      });
    });
  });
});
