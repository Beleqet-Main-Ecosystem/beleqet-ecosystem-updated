import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TelegramController } from './telegram.controller';
import { TelegramTmaService } from './telegram-tma.service';
import { TelegramService } from './telegram.service';
import { TmaUserRole } from './dto/telegram-tma.dto';

describe('TelegramController', () => {
  let controller: TelegramController;

  const mockTmaService = {
    authenticateTmaUser: jest.fn().mockResolvedValue({
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      user: { id: 'u-1', email: 'tma_12345@tme.beleqet.local' },
    }),
    linkTelegramAccount: jest.fn().mockResolvedValue({
      success: true,
      telegramId: '12345',
    }),
  };

  const mockTelegramService = {
    handleWebhookUpdate: jest.fn().mockResolvedValue({ ok: true }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: TelegramTmaService, useValue: mockTmaService },
        { provide: TelegramService, useValue: mockTelegramService },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  describe('tmaLogin', () => {
    it('delegates authentication and role to TelegramTmaService', async () => {
      const dto = { initData: 'query_id=test&hash=abc12345', role: TmaUserRole.EMPLOYER };
      const res = await controller.tmaLogin(dto);
      expect(mockTmaService.authenticateTmaUser).toHaveBeenCalledWith(dto.initData, dto.role);
      expect(res.accessToken).toBe('test-access-token');
    });
  });

  describe('tmaLink', () => {
    it('delegates linking to TelegramTmaService using the logged-in user ID', async () => {
      const userPayload = { userId: 'usr-456', email: 'existing@example.com', role: 'EMPLOYER' };
      const dto = { initData: 'query_id=test2&hash=fedcba98' };
      const res = await controller.tmaLink(userPayload, dto);
      expect(mockTmaService.linkTelegramAccount).toHaveBeenCalledWith('usr-456', dto.initData);
      expect(res.success).toBe(true);
    });
  });

  describe('handleWebhook', () => {
    it('forwards incoming webhook payload to TelegramService', async () => {
      const updatePayload = { update_id: 10001, message: { text: '/start' } };
      const res = await controller.handleWebhook(updatePayload);
      expect(mockTelegramService.handleWebhookUpdate).toHaveBeenCalledWith(updatePayload);
      expect(res).toEqual({ ok: true });
    });
  });
});
