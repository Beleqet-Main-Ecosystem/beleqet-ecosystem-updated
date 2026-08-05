import { Test, TestingModule } from '@nestjs/testing';
import { TelegramController } from './telegram.controller';
import { TelegramTmaService } from './telegram-tma.service';

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

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [TelegramController],
      providers: [{ provide: TelegramTmaService, useValue: mockTmaService }],
    }).compile();

    controller = module.get<TelegramController>(TelegramController);
  });

  describe('tmaLogin', () => {
    it('delegates authentication to TelegramTmaService', async () => {
      const dto = { initData: 'query_id=test&hash=abc12345' };
      const res = await controller.tmaLogin(dto);
      expect(mockTmaService.authenticateTmaUser).toHaveBeenCalledWith(dto.initData);
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
});
