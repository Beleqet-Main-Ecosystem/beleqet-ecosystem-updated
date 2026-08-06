import { Test, TestingModule } from '@nestjs/testing';
import { DisputeManagerService } from './dispute-manager.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { NotFoundException, BadRequestException } from '@nestjs/common';

/**
 * Unit tests for the Dispute Manager Service
 */
describe('DisputeManagerService', () => {
  let service: DisputeManagerService;
  let prismaService: jest.Mocked<PrismaService>;
  let i18nService: jest.Mocked<I18nService>;

  beforeEach(async () => {
    const prismaMock = {
      contract: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      dispute: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const i18nMock = {
      t: jest.fn().mockReturnValue('Dispute resolved successfully'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DisputeManagerService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: I18nService, useValue: i18nMock },
      ],
    }).compile();

    service = module.get<DisputeManagerService>(DisputeManagerService);
    prismaService = module.get(PrismaService);
    i18nService = module.get(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createDispute', () => {
    it('should throw NotFoundException if contract not found', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.createDispute('user-id', { contractId: 'c-id', reason: 'r', evidenceUrls: [] })
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user is not authorized', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue({
        id: 'c-id',
        clientId: 'client-id',
        freelancerId: 'freelancer-id',
      });

      await expect(
        service.createDispute('unauthorized-user', { contractId: 'c-id', reason: 'r', evidenceUrls: [] })
      ).rejects.toThrow(BadRequestException);
    });

    it('should create dispute successfully', async () => {
      (prismaService.contract.findUnique as jest.Mock).mockResolvedValue({
        id: 'c-id',
        clientId: 'user-id',
        freelancerId: 'freelancer-id',
      });
      (prismaService.dispute.create as jest.Mock).mockResolvedValue({ id: 'd-id' });

      const result = await service.createDispute('user-id', {
        contractId: 'c-id',
        reason: 'Poor quality',
        evidenceUrls: ['http://evidence.com'],
      });

      expect(prismaService.contract.update).toHaveBeenCalledWith({
        where: { id: 'c-id' },
        data: { status: 'DISPUTED' },
      });
      expect(result).toEqual({ id: 'd-id' });
    });
  });
});
