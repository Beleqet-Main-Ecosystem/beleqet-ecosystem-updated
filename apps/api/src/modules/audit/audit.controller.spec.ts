import { Test, TestingModule } from '@nestjs/testing';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

const mockAuditService = {
  findAll: jest.fn(),
};

describe('AuditController', () => {
  let controller: AuditController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuditController],
      providers: [{ provide: AuditService, useValue: mockAuditService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AuditController>(AuditController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should delegate to AuditService.findAll with the given query', async () => {
      const query = { eventType: 'USER_LOGIN', page: 1, limit: 25 };
      const expected = { items: [], total: 0, page: 1, limit: 25, totalPages: 0 };
      mockAuditService.findAll.mockResolvedValue(expected);

      const result = await controller.findAll(query);

      expect(mockAuditService.findAll).toHaveBeenCalledWith(query);
      expect(result).toBe(expected);
    });
  });
});
