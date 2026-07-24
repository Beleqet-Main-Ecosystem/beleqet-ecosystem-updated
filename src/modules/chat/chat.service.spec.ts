import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  chatRoom: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
  chatParticipant: {
    findUnique: jest.fn(),
  },
  message: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('saveMessage', () => {
    it('should save an encrypted message with IV in metadata', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ id: 'cp-1', roomId: 'room-1', userId: 'user-1' });

      const encryptedContent = 'AES-GCM-base64-ciphertext==';
      const metadata = { encrypted: true, iv: 'aabbccdd00112233' };
      const mockMsg = {
        id: 'msg-1',
        roomId: 'room-1',
        senderId: 'user-1',
        content: encryptedContent,
        metadata,
        createdAt: new Date(),
        sender: { id: 'user-1', firstName: 'Test', lastName: 'User', avatarUrl: null, role: 'FREELANCER' },
      };

      mockPrisma.message.create.mockResolvedValue(mockMsg);

      const result = await service.saveMessage('room-1', 'user-1', encryptedContent, metadata);

      expect(mockPrisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            content: encryptedContent,
            metadata: expect.objectContaining({ encrypted: true, iv: 'aabbccdd00112233' }),
          }),
        })
      );
      expect(result.content).toBe(encryptedContent);
      expect((result.metadata as any).iv).toBe('aabbccdd00112233');
    });

    it('should throw NotFoundException if user is not a participant', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue(null);

      await expect(
        service.saveMessage('room-1', 'non-member', 'ciphertext==', { encrypted: true, iv: 'iv' })
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getRoomMessages', () => {
    it('should return encrypted messages for a participant', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ id: 'cp-1' });
      const encryptedMessages = [
        {
          id: 'msg-1',
          roomId: 'room-1',
          content: 'ciphertext1==',
          metadata: { encrypted: true, iv: 'iv1' },
          sender: { id: 'user-1', firstName: 'A', lastName: 'B', avatarUrl: null, role: 'EMPLOYER' },
        },
      ];
      mockPrisma.message.findMany.mockResolvedValue(encryptedMessages);

      const result = await service.getRoomMessages('room-1', 'user-1');

      expect(result).toHaveLength(1);
      expect(result[0].content).toBe('ciphertext1==');
    });

    it('should throw NotFoundException for a non-participant', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue(null);

      await expect(service.getRoomMessages('room-1', 'intruder')).rejects.toThrow(NotFoundException);
    });
  });
});
