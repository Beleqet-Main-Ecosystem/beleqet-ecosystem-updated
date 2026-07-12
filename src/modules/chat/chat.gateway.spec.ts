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
  verify: jest.fn().mockReturnValue({ userId: 'test-user-id', email: 'test@test.com' }),
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
        { provide: ChatService,  useValue: mockChatService },
        { provide: JwtService,   useValue: mockJwtService },
        { provide: I18nService,  useValue: mockI18nService },
      ],
    }).compile();
    gateway = module.get<ChatGateway>(ChatGateway);
  });
  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});