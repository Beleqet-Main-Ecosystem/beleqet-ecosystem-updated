import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { TelegramController } from './telegram.controller';
import { TelegramTmaService } from './telegram-tma.service';
import { TelegramService } from './telegram.service';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { TmaUserRole } from './dto/telegram-tma.dto';
import { PaymentDecisionDto } from './dto/payment-decision.dto';
import { ManualPaymentService } from '../../payments/manual-payment/manual-payment.service';

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

  const mockManualPayments = {
    decideFromTelegram: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'SUCCEEDED' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [
        { provide: TelegramTmaService, useValue: mockTmaService },
        { provide: TelegramService, useValue: mockTelegramService },
        { provide: ManualPaymentService, useValue: mockManualPayments },
        { provide: ConfigService, useValue: { get: () => undefined } },
      ],
    })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  describe('tmaLogin', () => {
    it('delegates authentication to TelegramTmaService; the old role field is ignored', async () => {
      const dto = { initData: 'query_id=test&hash=abc12345', role: TmaUserRole.EMPLOYER };
      const res = await controller.tmaLogin(dto);
      expect(mockTmaService.authenticateTmaUser).toHaveBeenCalledWith(dto.initData);
      expect(res).toEqual(expect.objectContaining({ accessToken: 'test-access-token' }));
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

  describe('updatePaymentStatus', () => {
    // The API's own settings for every request body.
    const pipe = new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    });
    const check = (body: object) =>
      pipe.transform(body, { type: 'body', metatype: PaymentDecisionDto });

    it("approves or rejects for real, recording the admin's Telegram id", async () => {
      const approve = await check({
        order_id: 'pay-1',
        status: 'completed',
        admin_telegram_id: '712718884',
      });
      await expect(controller.updatePaymentStatus(approve)).resolves.toEqual({
        success: true,
        orderId: 'pay-1',
        status: 'SUCCEEDED',
      });
      expect(mockManualPayments.decideFromTelegram).toHaveBeenCalledWith(
        'pay-1',
        true,
        'telegram:712718884',
      );

      await controller.updatePaymentStatus(await check({ order_id: 'pay-1', status: 'cancelled' }));
      expect(mockManualPayments.decideFromTelegram).toHaveBeenLastCalledWith(
        'pay-1',
        false,
        'telegram:unknown',
      );
    });

    it('refuses anything but an approval or a rejection', async () => {
      for (const body of [
        { order_id: 'pay-1', status: 'refunded' },
        { order_id: '', status: 'completed' },
        { order_id: 'pay-1', status: 'completed', admin_telegram_id: 'admin' },
        { order_id: 'pay-1', status: 'completed', amount: 1 },
      ]) {
        await expect(check(body)).rejects.toThrow();
      }
    });
  });
});
