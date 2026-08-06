import { Test, TestingModule } from '@nestjs/testing';
import { AdminStatsService } from './admin-stats.service';
import { PrismaService } from '../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';
import { AdminStatsController } from './admin-stats.controller';
import { WalletService } from '../wallet/wallet.service';

/**
 * Unit tests for the Admin Stats Module
 */
describe('AdminStats Module', () => {
  let service: AdminStatsService;
  let controller: AdminStatsController;
  let prismaService: jest.Mocked<PrismaService>;
  let i18nService: jest.Mocked<I18nService>;
  let walletService: jest.Mocked<WalletService>;

  beforeEach(async () => {
    const prismaMock = {
      user: { count: jest.fn() },
      contract: { count: jest.fn() },
      freelanceJob: { count: jest.fn() },
      escrowTransaction: { findMany: jest.fn() },
    };

    const i18nMock = {
      t: jest.fn().mockReturnValue('Dashboard Statistics translated'),
    };

    const walletMock = {
      convertCurrency: jest.fn().mockImplementation((amount, from, to) => {
        if (from === to) return amount;
        return amount * 1.5;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminStatsController],
      providers: [
        AdminStatsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: I18nService, useValue: i18nMock },
        { provide: WalletService, useValue: walletMock },
      ],
    }).compile();

    service = module.get<AdminStatsService>(AdminStatsService);
    controller = module.get<AdminStatsController>(AdminStatsController);
    prismaService = module.get(PrismaService);
    i18nService = module.get(I18nService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
    expect(controller).toBeDefined();
  });

  describe('getDashboardStats', () => {
    it('should aggregate and return dashboard stats successfully', async () => {
      // Mock Prisma return values
      (prismaService.user.count as jest.Mock).mockResolvedValue(150);
      (prismaService.contract.count as jest.Mock).mockResolvedValue(20);
      (prismaService.freelanceJob.count as jest.Mock).mockResolvedValue(50);
      (prismaService.escrowTransaction.findMany as jest.Mock).mockResolvedValue([
        { netAmount: 100, currency: 'USD' },
        { netAmount: 200, currency: 'USD' },
      ]);

      const result = await controller.getDashboard({ currency: 'USD', lang: 'en' });

      expect(result).toEqual({
        totalUsers: 150,
        totalRevenue: 300,
        activeContracts: 20,
        completedJobs: 50,
        currency: 'USD',
        message: 'Dashboard Statistics translated',
      });

      expect(prismaService.user.count).toHaveBeenCalledWith({ where: { isActive: true } });
    });
  });
});
