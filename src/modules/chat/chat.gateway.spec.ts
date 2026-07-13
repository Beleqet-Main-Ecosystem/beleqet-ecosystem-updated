import { Test, TestingModule } from '@nestjs/testing';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { JwtService } from '@nestjs/jwt';
import { NotFoundException } from '@nestjs/common';
import { I18nService } from 'nestjs-i18n';

const mockChatService = {
  getRoomMessages: jest.fn(),
  saveMessage: jest.fn(),
};
const mockJwtService = {
  verify: jest.fn().mockReturnValue({ userId: 'user-test-1', email: 'test@beleqet.com' }),
};
const mockI18nService = {
  t: jest.fn((key: string) => key),
};

/** Build a minimal mock Socket.io client */
function buildClient(overrides: Partial<{ auth: object; headers: object }> = {}) {
  return {
    id: 'socket-id-001',
    data: {} as Record<string, unknown>,
    handshake: {
      auth: overrides.auth ?? { token: 'Bearer valid.jwt.token' },
      headers: overrides.headers ?? {},
    },
    join: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
  } as any;
}

describe('ChatGateway', () => {
  let gateway: ChatGateway;
  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatGateway,
        { provide: ChatService, useValue: mockChatService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();
    gateway = module.get<ChatGateway>(ChatGateway);
    // Simulate a server reference
    (gateway as any).server = { to: jest.fn().mockReturnValue({ emit: jest.fn() }) };
  });
  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
  describe('handleConnection', () => {
    it('should authenticate a client and set user data', async () => {
      const client = buildClient();
      await gateway.handleConnection(client);
      expect(client.data.user).toBeDefined();
      expect(client.data.user.userId).toBe('user-test-1');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('should disconnect a client without a token', async () => {
      const client = buildClient({ auth: {} });
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });

    it('should disconnect a client when JWT is invalid', async () => {
      mockJwtService.verify.mockImplementationOnce(() => { throw new Error('invalid token'); });
      const client = buildClient();
      await gateway.handleConnection(client);
      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoinRoom', () => {
    it('should join room and emit room history', async () => {
      const client = buildClient();
      client.data.user = { userId: 'user-test-1' };
      const mockHistory = [
        {
          id: 'msg-1',
          roomId: 'room-1',
          senderId: 'user-test-1',
          content: 'encryptedbase64==',
          metadata: { encrypted: true, iv: 'aabbccdd11223344aabbccdd' },
          createdAt: new Date(),
        },
      ];
      mockChatService.getRoomMessages.mockResolvedValue(mockHistory);

      await gateway.handleJoinRoom({ roomId: 'room-1' }, client);

      expect(client.join).toHaveBeenCalledWith('room-1');
      expect(client.emit).toHaveBeenCalledWith('room_history', mockHistory);
    });
  });

  describe('handleMessage (E2EE)', () => {
    it('should save an encrypted message and broadcast it', async () => {
      const client = buildClient();
      client.data.user = { userId: 'user-test-1' };

      const mockSaved = {
        id: 'msg-2',
        roomId: 'room-1',
        senderId: 'user-test-1',
        content: 'AES-GCM-ciphertext-base64==',
        metadata: { encrypted: true, iv: '112233aabb' },
        createdAt: new Date(),
        sender: { id: 'user-test-1', firstName: 'Test', lastName: 'User' },
      };
      mockChatService.saveMessage.mockResolvedValue(mockSaved);

      await gateway.handleMessage(
        { roomId: 'room-1', content: 'AES-GCM-ciphertext-base64==', iv: '112233aabb' },
        client
      );

      expect(mockChatService.saveMessage).toHaveBeenCalledWith(
        'room-1',
        'user-test-1',
        'AES-GCM-ciphertext-base64==',
        { encrypted: true, iv: '112233aabb' }
      );
      expect((gateway as any).server.to).toHaveBeenCalledWith('room-1');
    });

    it('should emit error when saveMessage fails', async () => {
      const client = buildClient();
      client.data.user = { userId: 'user-test-1' };
      mockChatService.saveMessage.mockRejectedValue(new NotFoundException('not a participant'));

      await gateway.handleMessage(
        { roomId: 'room-1', content: 'ciphertext==', iv: 'iv-hex' },
        client
      );

      expect(client.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.any(String) }));
    });
  });
});
