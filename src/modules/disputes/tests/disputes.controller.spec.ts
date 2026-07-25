import { Test, TestingModule } from '@nestjs/testing';
import { DisputesController } from '../disputes.controller';
import { DisputesService } from '../disputes.service';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RolesGuard } from '@common/guards/roles.guard';

describe('DisputesController', () => {
  let controller: DisputesController;
  let mockService: Partial<DisputesService>;
  const mockReq = { headers: {}, query: {} } as any;

  beforeEach(async () => {
    mockService = {
      createDispute: jest.fn(),
      getDisputeByContract: jest.fn(),
      getMyDisputes: jest.fn(),
      fetchAllDisputes: jest.fn(),
      resolveDispute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DisputesController],
      providers: [{ provide: DisputesService, useValue: mockService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<DisputesController>(DisputesController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should call service.createDispute with correct parameters', async () => {
      const mockUser = { userId: 'user-1' };
      const dto = { contractId: 'contract-1', reason: 'Test reason with sufficient length' } as any;
      const expectedResult = { success: true, message: 'Dispute created' };

      mockService.createDispute = jest.fn().mockResolvedValue(expectedResult);

      const result = await controller.create(dto, mockUser as any, mockReq);

      expect(mockService.createDispute).toHaveBeenCalledWith('user-1', dto, undefined);
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getMyDisputes', () => {
    it('should return user disputes', async () => {
      const mockUser = { userId: 'user-1' };
      const expectedDisputes = [
        {
          id: 'dispute-1',
          contractId: 'contract-1',
          reason: 'Test reason',
          evidenceUrls: [],
          contract: { id: 'contract-1', status: 'ACTIVE' },
          raisedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe' },
        },
      ];

      mockService.getMyDisputes = jest.fn().mockResolvedValue(expectedDisputes);

      const result = await controller.getMyDisputes({ userId: 'user-1' } as any);

      expect(mockService.getMyDisputes).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(expectedDisputes);
    });
  });

  describe('getByContract', () => {
    it('should return dispute by contract', async () => {
      const mockUser = { userId: 'user-1' };
      const expectedDispute = {
        id: 'dispute-1',
        contractId: 'contract-1',
        contract: { id: 'contract-1', clientId: 'client-1', freelancerId: 'freelancer-1' },
        raisedBy: { id: 'user-1', firstName: 'John', lastName: 'Doe', email: 'john@example.com' },
        reason: 'Test reason',
        evidenceUrls: [],
      };

      mockService.getDisputeByContract = jest.fn().mockResolvedValue(expectedDispute);

      const result = await controller.getByContract('contract-1', { userId: 'user-1' } as any);

      expect(mockService.getDisputeByContract).toHaveBeenCalledWith('contract-1', 'user-1');
      expect(result).toEqual(expectedDispute);
    });
  });

  describe('getAllDisputes', () => {
    it('should return all disputes', async () => {
      const expectedDisputes = [{ id: 'dispute-1' }];
      mockService.fetchAllDisputes = jest.fn().mockResolvedValue(expectedDisputes);

      const result = await controller.getAllDisputes();

      expect(mockService.fetchAllDisputes).toHaveBeenCalled();
      expect(result).toEqual(expectedDisputes);
    });
  });

  describe('resolveDispute', () => {
    it('should call service.resolveDispute with correct parameters', async () => {
      const mockUser = { userId: 'admin-1' };
      const dto = {
        resolution: 'Test resolution',
        resolutionType: 'RELEASE_TO_FREELANCER',
        partialPercentage: undefined,
      } as any;
      const expectedResult = { success: true, message: 'Dispute resolved successfully.' };

      mockService.resolveDispute = jest.fn().mockResolvedValue(expectedResult);

      const result = await controller.resolveDispute('dispute-1', dto, mockUser as any, mockReq);

      expect(mockService.resolveDispute).toHaveBeenCalledWith(
        'dispute-1',
        dto.resolution,
        dto.resolutionType,
        'admin-1',
        dto.partialPercentage,
        undefined,
      );
      expect(result).toEqual(expectedResult);
    });
  });
});
