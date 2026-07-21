import { Test, TestingModule } from '@nestjs/testing';
import { EncryptedInboxController } from '../encrypted-inbox.controller';
import { EncryptedInboxService } from '../encrypted-inbox.service';
import { KeyExchangeService } from '../key-exchange.service';

describe('EncryptedInboxController', () => {
  let controller: EncryptedInboxController;
  let inboxService: Record<string, jest.Mock>;
  let keyExchange: Record<string, jest.Mock>;

  const mockUser = { userId: 'user-1', email: 'test@test.com', role: 'JOB_SEEKER' };

  beforeEach(async () => {
    inboxService = {
      createOrGetConversation: jest.fn(),
      listConversations: jest.fn(),
      getConversationInfo: jest.fn(),
      sendMessage: jest.fn(),
      getMessages: jest.fn(),
      deleteMessage: jest.fn(),
      archiveConversation: jest.fn(),
      blockConversation: jest.fn(),
      exportUserData: jest.fn(),
      deleteAllUserData: jest.fn(),
    };

    keyExchange = {
      registerKeyPair: jest.fn(),
      rotateKeyPair: jest.fn(),
      getPublicKey: jest.fn(),
      hasKeyPair: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [EncryptedInboxController],
      providers: [
        { provide: EncryptedInboxService, useValue: inboxService },
        { provide: KeyExchangeService, useValue: keyExchange },
      ],
    }).compile();

    controller = module.get(EncryptedInboxController);
  });

  describe('Key Management', () => {
    it('should register keys', async () => {
      keyExchange.registerKeyPair.mockResolvedValue({ id: 'kp-1' });
      const result = await controller.registerKeys(mockUser as any, {
        publicKey: 'pub',
        encryptedPrivateKey: 'enc-priv',
      });
      expect(result).toEqual({ id: 'kp-1' });
      expect(keyExchange.registerKeyPair).toHaveBeenCalledWith('user-1', {
        publicKey: 'pub',
        encryptedPrivateKey: 'enc-priv',
      });
    });

    it('should rotate keys', async () => {
      keyExchange.rotateKeyPair.mockResolvedValue({ id: 'kp-1' });
      const result = await controller.rotateKeys(mockUser as any, {
        publicKey: 'new-pub',
        encryptedPrivateKey: 'new-enc-priv',
      });
      expect(result).toEqual({ id: 'kp-1' });
    });

    it('should get public key', async () => {
      keyExchange.getPublicKey.mockResolvedValue('public-key');
      const result = await controller.getPublicKey('user-2');
      expect(result).toEqual({ userId: 'user-2', publicKey: 'public-key' });
    });

    it('should check key status', async () => {
      keyExchange.hasKeyPair.mockResolvedValue(true);
      const result = await controller.getKeyStatus(mockUser as any);
      expect(result).toEqual({ userId: 'user-1', hasKeyPair: true });
    });
  });

  describe('Conversations', () => {
    it('should create a conversation', async () => {
      inboxService.createOrGetConversation.mockResolvedValue({ id: 'conv-1' });
      const result = await controller.createConversation(mockUser as any, {
        participantId: 'user-2',
      });
      expect(result).toEqual({ id: 'conv-1' });
    });

    it('should list conversations', async () => {
      inboxService.listConversations.mockResolvedValue({
        conversations: [],
        pagination: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      const result = await controller.listConversations(mockUser as any, {});
      expect(result.pagination.total).toBe(0);
    });

    it('should get conversation info', async () => {
      inboxService.getConversationInfo.mockResolvedValue({ id: 'conv-1', messageCount: 5 });
      const result = await controller.getConversationInfo(mockUser as any, 'conv-1');
      expect(result.messageCount).toBe(5);
    });

    it('should archive conversation', async () => {
      inboxService.archiveConversation.mockResolvedValue({ status: 'ARCHIVED' });
      const result = await controller.archiveConversation(mockUser as any, 'conv-1');
      expect(result.status).toBe('ARCHIVED');
    });

    it('should block conversation', async () => {
      inboxService.blockConversation.mockResolvedValue({ status: 'BLOCKED' });
      const result = await controller.blockConversation(mockUser as any, 'conv-1');
      expect(result.status).toBe('BLOCKED');
    });
  });

  describe('Messages', () => {
    it('should send a message', async () => {
      inboxService.sendMessage.mockResolvedValue({ id: 'msg-1' });
      const result = await controller.sendMessage(mockUser as any, {
        conversationId: 'conv-1',
        ciphertext: 'encrypted',
        iv: 'test-iv',
      });
      expect(result).toEqual({ id: 'msg-1' });
    });

    it('should get messages', async () => {
      inboxService.getMessages.mockResolvedValue({ messages: [], nextCursor: null });
      const result = await controller.getMessages(mockUser as any, {
        conversationId: 'conv-1',
      });
      expect(result.messages).toHaveLength(0);
    });

    it('should delete a message', async () => {
      inboxService.deleteMessage.mockResolvedValue({ isDeleted: true });
      const result = await controller.deleteMessage(mockUser as any, 'msg-1', {
        reason: 'test',
      });
      expect(result.isDeleted).toBe(true);
    });
  });

  describe('GDPR', () => {
    it('should export user data', async () => {
      inboxService.exportUserData.mockResolvedValue([]);
      const result = await controller.gdprExport(mockUser as any);
      expect(result).toEqual([]);
    });

    it('should delete all user data', async () => {
      inboxService.deleteAllUserData.mockResolvedValue({ messagesScrubbed: 10 });
      const result = await controller.gdprDelete(mockUser as any);
      expect(result.messagesScrubbed).toBe(10);
    });
  });
});
