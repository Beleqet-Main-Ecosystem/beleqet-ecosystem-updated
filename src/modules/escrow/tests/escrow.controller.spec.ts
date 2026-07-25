import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { I18nService } from 'nestjs-i18n';

import { EscrowController } from '../escrow.controller';
import { EscrowService } from '../escrow.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';
import * as crypto from 'crypto';

describe('EscrowController', () => {
  let controller: EscrowController;
  let mockService: Partial<EscrowService>;
  let mockConfig: Partial<ConfigService>;
  const mockI18nService = {
    t: jest.fn((key: string, options?: { defaultValue?: string }) => options?.defaultValue || key),
  };

  const mockUser = { userId: 'user-1', role: 'EMPLOYER' } as any;
  const mockReq = { headers: {}, query: {} } as any;

  beforeEach(async () => {
    mockService = {
      initiate: jest.fn(),
      handleWebhook: jest.fn(),
      releaseMilestone: jest.fn(),
      listByClient: jest.fn(),
      getEmployerEscrowSummary: jest.fn(),
      getByIdForClient: jest.fn(),
      listByFreelancer: jest.fn(),
      getFreelancerEscrowSummary: jest.fn(),
      getByIdForFreelancer: jest.fn(),
      adminGetEscrowDetail: jest.fn(),
      adminForceRelease: jest.fn(),
      adminForceRefund: jest.fn(),
      cancelEscrow: jest.fn(),
      completeContract: jest.fn(),
    };

    mockConfig = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          CHAPA_WEBHOOK_SECRET: 'test-secret',
          NODE_ENV: 'test',
          FRONTEND_URL: 'http://localhost:3000',
        };
        return config[key];
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        { provide: EscrowService, useValue: mockService },
        { provide: ConfigService, useValue: mockConfig },
        { provide: I18nService, useValue: mockI18nService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<EscrowController>(EscrowController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initiate', () => {
    it('should call svc.initiate', async () => {
      mockService.initiate = jest.fn().mockResolvedValue({ escrowId: 'e1' });
      const result = await controller.initiate('gig-1', mockUser, mockReq);
      expect(mockService.initiate).toHaveBeenCalledWith('user-1', 'gig-1', undefined);
      expect(result).toEqual({ escrowId: 'e1' });
    });
  });

  describe('webhook', () => {
    it('should process GET requests and return redirect URL', async () => {
      const mockReq = { method: 'GET', query: { trx_ref: 'ref-1' } } as any;
      const result = await controller.webhook({}, mockReq);
      expect(mockService.handleWebhook).toHaveBeenCalledWith({ tx_ref: 'ref-1', trx_ref: 'ref-1' });
      expect(result).toEqual({ url: 'http://localhost:3000/freelance/payment-success' });
    });

    it('should process valid POST webhook', async () => {
      const payload = { tx_ref: 'ref-1' };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const mockReq = { method: 'POST', query: {}, rawBody } as any;
      const signature = crypto.createHmac('sha256', 'test-secret').update(rawBody).digest('hex');

      const result = await controller.webhook(payload, mockReq, signature);
      expect(mockService.handleWebhook).toHaveBeenCalledWith({ tx_ref: 'ref-1' });
      expect(result).toEqual({ success: true });
    });

    it('should reject invalid POST webhook in production', async () => {
      mockConfig.get = jest.fn((key) => (key === 'NODE_ENV' ? 'production' : 'test-secret'));
      const mockReq = { method: 'POST', query: {}, rawBody: Buffer.from('{}') } as any;

      await expect(controller.webhook({}, mockReq, 'invalid-sig')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('release', () => {
    it('should call svc.releaseMilestone', async () => {
      mockService.releaseMilestone = jest.fn().mockResolvedValue({ success: true });
      const result = await controller.release('m-1', mockUser);
      expect(mockService.releaseMilestone).toHaveBeenCalledWith('m-1', 'user-1');
      expect(result).toEqual({ success: true });
    });
  });

  describe('listMyEscrows', () => {
    it('should call svc.listByClient with pagination', async () => {
      const mockReq = { query: { page: '2', limit: '10' } } as any;
      mockService.listByClient = jest.fn().mockResolvedValue({ items: [] });
      const result = await controller.listMyEscrows(mockUser, mockReq);
      expect(mockService.listByClient).toHaveBeenCalledWith('user-1', 2, 10);
      expect(result).toEqual({ items: [] });
    });
  });

  describe('getSummary', () => {
    it('should call svc.getEmployerEscrowSummary', async () => {
      mockService.getEmployerEscrowSummary = jest.fn().mockResolvedValue({ total: 5 });
      const result = await controller.getSummary(mockUser);
      expect(mockService.getEmployerEscrowSummary).toHaveBeenCalledWith('user-1');
      expect(result).toEqual({ total: 5 });
    });
  });

  describe('getEscrowDetail', () => {
    it('should call svc.getByIdForClient', async () => {
      mockService.getByIdForClient = jest.fn().mockResolvedValue({ id: 'e1' });
      const result = await controller.getEscrowDetail('e1', mockUser);
      expect(mockService.getByIdForClient).toHaveBeenCalledWith('e1', 'user-1');
      expect(result).toEqual({ id: 'e1' });
    });
  });

  describe('freelancer endpoints', () => {
    it('should call listEscrowsForFreelancer', async () => {
      const mockReq = { query: { page: '1', limit: '20' } } as any;
      mockService.listByFreelancer = jest.fn().mockResolvedValue({ items: [] });
      await controller.listEscrowsForFreelancer(mockReq, mockUser);
      expect(mockService.listByFreelancer).toHaveBeenCalledWith('user-1', 1, 20);
    });

    it('should call getFreelancerSummary', async () => {
      mockService.getFreelancerEscrowSummary = jest.fn().mockResolvedValue({});
      await controller.getFreelancerSummary(mockUser);
      expect(mockService.getFreelancerEscrowSummary).toHaveBeenCalledWith('user-1');
    });

    it('should call getEscrowDetailForFreelancer', async () => {
      mockService.getByIdForFreelancer = jest.fn().mockResolvedValue({});
      await controller.getEscrowDetailForFreelancer('e1', mockUser);
      expect(mockService.getByIdForFreelancer).toHaveBeenCalledWith('e1', 'user-1');
    });
  });

  describe('admin endpoints', () => {
    it('should call adminGetDetail', async () => {
      mockService.adminGetEscrowDetail = jest.fn().mockResolvedValue({});
      await controller.adminGetDetail('e1');
      expect(mockService.adminGetEscrowDetail).toHaveBeenCalledWith('e1');
    });

    it('should call adminForceRelease', async () => {
      mockService.adminForceRelease = jest.fn().mockResolvedValue({});
      await controller.adminForceRelease('e1', mockUser);
      expect(mockService.adminForceRelease).toHaveBeenCalledWith('e1', 'user-1');
    });

    it('should call adminForceRefund', async () => {
      mockService.adminForceRefund = jest.fn().mockResolvedValue({});
      await controller.adminForceRefund('e1', mockUser, mockReq);
      expect(mockService.adminForceRefund).toHaveBeenCalledWith('e1', 'user-1', undefined);
    });
  });

  describe('cancel', () => {
    it('should call cancelEscrow', async () => {
      mockService.cancelEscrow = jest.fn().mockResolvedValue({ success: true });
      await controller.cancel('e1', mockUser, mockReq);
      expect(mockService.cancelEscrow).toHaveBeenCalledWith('e1', 'user-1', undefined);
    });
  });

  describe('completeContract', () => {
    it('should call completeContract', async () => {
      mockService.completeContract = jest.fn().mockResolvedValue({ success: true });
      await controller.completeContract('c1', mockUser, mockReq);
      expect(mockService.completeContract).toHaveBeenCalledWith('c1', 'user-1', undefined);
    });
  });
});
