import { Test, TestingModule } from '@nestjs/testing';
import { EncryptedInboxService } from '../encrypted-inbox.service';
import { E2EEServerEncryptionService } from '../encryption.service';
import { PrismaService } from '@prisma-client';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';

describe('EncryptedInboxService', () => {
  let service: EncryptedInboxService;
  let prisma: Record<string, any>;
  let encryption: Record<string, jest.Mock>;

  const mockConversation = {
    id: 'conv-1',
    initiatorId: 'user-1',
    responderId: 'user-2',
    status: 'ACTIVE',
    createdAt: new Date(),
    updatedAt: new Date(),
    messages: [],
  };

  const mockMessage = {
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'user-1',
    ciphertext: 'encrypted-content',
    iv: 'test-iv',
    encryptedMetadata: null,
    serverCiphertext: null,
    serverEncryptionVersion: 'v1',
    isSystem: false,
    isDeleted: false,
    deletedAt: null,
    createdAt: new Date(),
    conversation: mockConversation,
    sender: { id: 'user-1', firstName: 'John', lastName: 'Doe', avatarUrl: null },
  };

  beforeEach(async () => {
    prisma = {
      encryptedConversation: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      encryptedMessage: {
        findUnique: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
        count: jest.fn(),
      },
      e2EKeyPair: {
        deleteMany: jest.fn(),
      },
      eventLog: {
        create: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
    };

    encryption = {
      getKeyVersion: jest.fn().mockReturnValue('v1'),
      encrypt: jest.fn().mockReturnValue({ ciphertext: 'encrypted', iv: 'iv', keyVersion: 'v1' }),
      decrypt: jest.fn().mockReturnValue('decrypted-content'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptedInboxService,
        { provide: PrismaService, useValue: prisma },
        { provide: E2EEServerEncryptionService, useValue: encryption },
      ],
    }).compile();

    service = module.get(EncryptedInboxService);
  });

  describe('createOrGetConversation', () => {
    it('should create a new conversation', async () => {
      prisma.encryptedConversation.findFirst.mockResolvedValue(null);
      prisma.encryptedConversation.create.mockResolvedValue(mockConversation);

      const result = await service.createOrGetConversation('user-1', {
        participantId: 'user-2',
      });

      expect(result).toEqual(mockConversation);
      expect(prisma.encryptedConversation.create).toHaveBeenCalledWith({
        data: {
          initiatorId: 'user-1',
          responderId: 'user-2',
        },
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
            select: { id: true, senderId: true, createdAt: true },
          },
        },
      });
    });

    it('should return existing conversation if found', async () => {
      prisma.encryptedConversation.findFirst.mockResolvedValue(mockConversation);

      const result = await service.createOrGetConversation('user-1', {
        participantId: 'user-2',
      });

      expect(result).toEqual(mockConversation);
      expect(prisma.encryptedConversation.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException when creating conversation with self', async () => {
      await expect(
        service.createOrGetConversation('user-1', { participantId: 'user-1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('listConversations', () => {
    it('should return paginated conversations', async () => {
      prisma.encryptedConversation.findMany.mockResolvedValue([mockConversation]);
      prisma.encryptedConversation.count.mockResolvedValue(1);

      const result = await service.listConversations('user-1', {});

      expect(result.conversations).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(result.pagination.page).toBe(1);
    });

    it('should filter by status', async () => {
      prisma.encryptedConversation.findMany.mockResolvedValue([]);
      prisma.encryptedConversation.count.mockResolvedValue(0);

      await service.listConversations('user-1', { status: 'ARCHIVED' });

      expect(prisma.encryptedConversation.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'ARCHIVED' }),
        }),
      );
    });
  });

  describe('sendMessage', () => {
    it('should save and return an encrypted message', async () => {
      prisma.encryptedConversation.findUnique.mockResolvedValue(mockConversation);
      prisma.encryptedMessage.create.mockResolvedValue(mockMessage);
      prisma.encryptedConversation.update.mockResolvedValue(mockConversation);

      const result = await service.sendMessage('user-1', {
        conversationId: 'conv-1',
        ciphertext: 'encrypted-content',
        iv: 'test-iv',
        serverCiphertext: 'server-encrypted',
      });

      expect(result).toEqual(mockMessage);
      expect(prisma.encryptedMessage.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if user is not a participant', async () => {
      const nonParticipantConversation = {
        ...mockConversation,
        initiatorId: 'user-x',
        responderId: 'user-y',
      };
      prisma.encryptedConversation.findUnique.mockResolvedValue(nonParticipantConversation);

      await expect(
        service.sendMessage('user-1', {
          conversationId: 'conv-1',
          ciphertext: 'test',
          iv: 'iv',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if conversation is blocked', async () => {
      const blockedConversation = { ...mockConversation, status: 'BLOCKED' };
      prisma.encryptedConversation.findUnique.mockResolvedValue(blockedConversation);

      await expect(
        service.sendMessage('user-1', {
          conversationId: 'conv-1',
          ciphertext: 'test',
          iv: 'iv',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('getMessages', () => {
    it('should return paginated messages', async () => {
      prisma.encryptedConversation.findUnique.mockResolvedValue(mockConversation);
      prisma.encryptedMessage.findMany.mockResolvedValue([mockMessage]);

      const result = await service.getMessages('user-1', {
        conversationId: 'conv-1',
      });

      expect(result.messages).toHaveLength(1);
      expect(result.nextCursor).toBeNull();
    });

    it('should throw ForbiddenException if user is not a participant', async () => {
      const nonParticipantConversation = {
        ...mockConversation,
        initiatorId: 'user-x',
        responderId: 'user-y',
      };
      prisma.encryptedConversation.findUnique.mockResolvedValue(nonParticipantConversation);

      await expect(service.getMessages('user-1', { conversationId: 'conv-1' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('deleteMessage', () => {
    it('should soft-delete a message', async () => {
      prisma.encryptedMessage.findUnique.mockResolvedValue(mockMessage);
      prisma.encryptedMessage.update.mockResolvedValue({
        ...mockMessage,
        isDeleted: true,
        ciphertext: '[DELETED]',
      });
      prisma.eventLog.create.mockResolvedValue({});

      const result = await service.deleteMessage('user-1', 'msg-1', 'Privacy concern');

      expect(result.isDeleted).toBe(true);
      expect(prisma.eventLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if message not found', async () => {
      prisma.encryptedMessage.findUnique.mockResolvedValue(null);

      await expect(service.deleteMessage('user-1', 'nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if not the sender', async () => {
      const otherSenderMessage = { ...mockMessage, senderId: 'user-2' };
      prisma.encryptedMessage.findUnique.mockResolvedValue(otherSenderMessage);

      await expect(service.deleteMessage('user-1', 'msg-1')).rejects.toThrow(ForbiddenException);
    });
  });

  describe('archiveConversation', () => {
    it('should archive a conversation', async () => {
      prisma.encryptedConversation.findUnique.mockResolvedValue(mockConversation);
      prisma.encryptedConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'ARCHIVED',
      });

      const result = await service.archiveConversation('user-1', 'conv-1');
      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('blockConversation', () => {
    it('should block a conversation', async () => {
      prisma.encryptedConversation.findUnique.mockResolvedValue(mockConversation);
      prisma.encryptedConversation.update.mockResolvedValue({
        ...mockConversation,
        status: 'BLOCKED',
      });

      const result = await service.blockConversation('user-1', 'conv-1');
      expect(result.status).toBe('BLOCKED');
    });
  });

  describe('exportUserData', () => {
    it('should export user data with decrypted server copies', async () => {
      prisma.encryptedConversation.findMany.mockResolvedValue([
        {
          ...mockConversation,
          messages: [{ ...mockMessage, serverCiphertext: 'server-encrypted' }],
        },
      ]);
      prisma.eventLog.create.mockResolvedValue({});

      const result = await service.exportUserData('user-1');

      expect(result).toHaveLength(1);
      expect(result[0].messages).toHaveLength(1);
      expect(prisma.eventLog.create).toHaveBeenCalled();
    });
  });

  describe('deleteAllUserData', () => {
    it('should scrub all sent messages and delete key pair', async () => {
      prisma.encryptedMessage.updateMany.mockResolvedValue({ count: 5 });
      prisma.e2EKeyPair.deleteMany.mockResolvedValue({ count: 1 });
      prisma.eventLog.create.mockResolvedValue({});

      const result = await service.deleteAllUserData('user-1');

      expect(result.messagesScrubbed).toBe(5);
      expect(prisma.e2EKeyPair.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('getConversationInfo', () => {
    it('should return conversation with participant info', async () => {
      prisma.encryptedConversation.findUnique.mockResolvedValue(mockConversation);
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Smith',
        avatarUrl: null,
        role: 'JOB_SEEKER',
      });
      prisma.encryptedMessage.count.mockResolvedValue(10);

      const result = await service.getConversationInfo('user-1', 'conv-1');

      expect(result.otherParticipant).toBeDefined();
      expect(result.messageCount).toBe(10);
    });
  });
});
