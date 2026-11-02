import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { I18nService } from 'nestjs-i18n';

const mockChatService = {
  getRoomMessages: jest.fn(),
  saveMessage: jest.fn(),
};

const mockJwtService = {
  verify: jest.fn().mockReturnValue({ sub: 'test-user-id', email: 'test@test.com', role: 'JOB_SEEKER' }),
};

const mockI18nService = {
  t: jest.fn((key: string) => key),
};

describe('ChatGateway', () => {
  let gateway: ChatGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    gateway = module.get<ChatGateway>(ChatGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('maps the access token subject to userId on connect', async () => {
    const client = { id: 'c1', handshake: { auth: { token: 'Bearer abc' }, headers: {} }, data: {} as any, emit: jest.fn(), disconnect: jest.fn() };
    await gateway.handleConnection(client as any);
    expect(client.data.user).toEqual({ userId: 'test-user-id', email: 'test@test.com', role: 'JOB_SEEKER' });
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects a token without the access claims', async () => {
    mockJwtService.verify.mockReturnValueOnce({ sub: 'u1', purpose: '2fa_step_up_challenge' });
    const client = { id: 'c2', handshake: { auth: { token: 'abc' }, headers: {} }, data: {} as any, emit: jest.fn(), disconnect: jest.fn() };
    await gateway.handleConnection(client as any);
    expect(client.disconnect).toHaveBeenCalled();
  });
});
