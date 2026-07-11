import { Test, TestingModule } from '@nestjs/testing';
import { EscrowController } from './escrow.controller';
import { EscrowService } from './escrow.service';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { REDIS_CLIENT } from '../redis/redis.module';

const mockSvc = {
  initiate: jest.fn(),
  handleWebhook: jest.fn(),
  releaseMilestone: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: string) => {
    if (key === 'NODE_ENV') return 'test';
    if (key === 'CHAPA_WEBHOOK_SECRET') return 'test-secret';
    if (key === 'FRONTEND_URL') return 'http://localhost:3000';
    if (key === 'JWT_ACCESS_SECRET') return 'test-secret';
    if (key === 'TOTP_TEMP_SECRET') return 'test-totp-secret';
    return fallback;
  }),
};

const mockUser = { userId: 'u1', email: 'u@t.com', role: 'CLIENT' };

describe('EscrowController', () => {
  let controller: EscrowController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EscrowController],
      providers: [
        { provide: EscrowService, useValue: mockSvc },
        { provide: ConfigService, useValue: mockConfig },
        { provide: JwtService, useValue: { sign: jest.fn(), verify: jest.fn() } },
        { provide: Reflector, useValue: new Reflector() },
        { provide: PrismaService, useValue: { userTwoFactor: { findUnique: jest.fn().mockResolvedValue(null) } } },
        { provide: REDIS_CLIENT, useValue: { get: jest.fn(), set: jest.fn() } },
      ],
    }).compile();
    controller = module.get<EscrowController>(EscrowController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('initiate', () => {
    it('should initiate escrow', async () => {
      mockSvc.initiate.mockResolvedValue({ escrowId: 'e1', checkoutUrl: 'http://pay.test' });
      const result = await controller.initiate('g1', mockUser);
      expect(result.escrowId).toBe('e1');
    });
  });

  describe('webhook', () => {
    it('should process POST webhook', async () => {
      const req = { method: 'POST', rawBody: Buffer.from('test'), query: {} } as any;
      const result = await controller.webhook({ reference: 'ref-1', status: 'success' }, req, 'sig', undefined);
      expect(result.success).toBe(true);
    });

    it('should process GET webhook redirect', async () => {
      const req = { method: 'GET', rawBody: Buffer.from(''), query: { trx_ref: 'ref-1' } } as any;
      const result = await controller.webhook({}, req, undefined, undefined);
      expect(result.url).toContain('payment-success');
    });
  });

  describe('release', () => {
    it('should release milestone', async () => {
      mockSvc.releaseMilestone.mockResolvedValue({ success: true });
      const result = await controller.release('m1', mockUser);
      expect(result.success).toBe(true);
    });
  });
});
