import { Test, TestingModule } from '@nestjs/testing';
import { EncryptedInboxGateway } from '../encrypted-inbox.gateway';
import { EncryptedInboxService } from '../encrypted-inbox.service';
import { KeyExchangeService } from '../key-exchange.service';
import { JwtService } from '@nestjs/jwt';

describe('EncryptedInboxGateway', () => {
  let gateway: EncryptedInboxGateway;
  let inboxService: Record<string, jest.Mock>;
  let keyExchange: Record<string, jest.Mock>;
  let jwtService: Record<string, jest.Mock>;

  beforeEach(async () => {
    inboxService = {
      getMessages: jest.fn(),
      sendMessage: jest.fn(),
    };

    keyExchange = {
      getPublicKey: jest.fn(),
    };

    jwtService = {
      verify: jest.fn().mockReturnValue({ userId: 'user-1', email: 'test@test.com' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptedInboxGateway,
        { provide: EncryptedInboxService, useValue: inboxService },
        { provide: KeyExchangeService, useValue: keyExchange },
        { provide: JwtService, useValue: jwtService },
      ],
    }).compile();

    gateway = module.get(EncryptedInboxGateway);
  });

  describe('handleConnection', () => {
    it('should accept valid JWT connections', () => {
      const client = {
        id: 'client-1',
        handshake: { auth: { token: 'Bearer valid-token' }, headers: {} },
        data: {} as any,
        disconnect: jest.fn(),
        emit: jest.fn(),
        join: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      };

      gateway.handleConnection(client as any);

      expect(client.data.user).toEqual({
        userId: 'user-1',
        email: 'test@test.com',
      });
    });

    it('should reject connections without token', () => {
      const client = {
        id: 'client-1',
        handshake: { auth: {}, headers: {} },
        data: {} as any,
        disconnect: jest.fn(),
        emit: jest.fn(),
      };

      gateway.handleConnection(client as any);

      expect(client.disconnect).toHaveBeenCalled();
    });
  });

  describe('handleJoinConversation', () => {
    it('should join a conversation and return history', async () => {
      const messages = [{ id: 'msg-1', ciphertext: 'encrypted' }];
      inboxService.getMessages.mockResolvedValue({ messages, nextCursor: null });

      const client = {
        id: 'client-1',
        data: { user: { userId: 'user-1' } },
        join: jest.fn(),
        emit: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as any;

      const server = {
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as any;
      gateway.server = server;

      await gateway.handleJoinConversation({ conversationId: 'conv-1' }, client);

      expect(client.join).toHaveBeenCalledWith('conv-1');
      expect(client.emit).toHaveBeenCalledWith('conversation_history', messages);
    });
  });

  describe('handleSendMessage', () => {
    it('should save and broadcast encrypted message', async () => {
      const savedMessage = { id: 'msg-1', ciphertext: 'encrypted' };
      inboxService.sendMessage.mockResolvedValue(savedMessage);

      const broadcastEmit = jest.fn();
      const server = {
        to: jest.fn().mockReturnValue({ emit: broadcastEmit }),
      } as any;
      gateway.server = server;

      const client = {
        id: 'client-1',
        data: { user: { userId: 'user-1' } },
        emit: jest.fn(),
        join: jest.fn(),
        to: jest.fn().mockReturnValue({ emit: broadcastEmit }),
      } as any;

      await gateway.handleSendMessage(
        {
          conversationId: 'conv-1',
          ciphertext: 'encrypted',
          iv: 'test-iv',
        },
        client,
      );

      expect(inboxService.sendMessage).toHaveBeenCalledWith('user-1', {
        conversationId: 'conv-1',
        ciphertext: 'encrypted',
        iv: 'test-iv',
        encryptedMetadata: undefined,
        serverCiphertext: undefined,
      });
    });
  });

  describe('handleKeyExchange', () => {
    it('should return public key for target user', async () => {
      keyExchange.getPublicKey.mockResolvedValue('public-key-123');

      const client = {
        id: 'client-1',
        data: { user: { userId: 'user-1' } },
        emit: jest.fn(),
      } as any;

      await gateway.handleKeyExchange({ targetUserId: 'user-2' }, client);

      expect(client.emit).toHaveBeenCalledWith('key_exchange_response', {
        targetUserId: 'user-2',
        publicKey: 'public-key-123',
      });
    });

    it('should handle missing key pair gracefully', async () => {
      keyExchange.getPublicKey.mockRejectedValue(new Error('Not found'));

      const client = {
        id: 'client-1',
        data: { user: { userId: 'user-1' } },
        emit: jest.fn(),
      } as any;

      await gateway.handleKeyExchange({ targetUserId: 'user-2' }, client);

      expect(client.emit).toHaveBeenCalledWith('key_exchange_response', {
        targetUserId: 'user-2',
        publicKey: null,
        error: 'User has no registered E2EE keys',
      });
    });
  });
});
