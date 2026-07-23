import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

const mockPrisma = {
  chatRoom: {
    findUnique: jest.fn(),
    findMany: jest.fn(),
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

  describe('createOrGetRoom', () => {
    it('should return existing room when searching for direct message between two users', async () => {
      const mockExistingRoom = {
        id: 'existing-room-id',
        contractId: null,
        participants: [
          { id: 'p1', userId: 'user-1' },
          { id: 'p2', userId: 'user-2' },
        ],
        messages: [],
      };

      mockPrisma.chatRoom.findMany.mockResolvedValue([mockExistingRoom]);

      const result = await service.createOrGetRoom('user-1', 'user-2');

      expect(mockPrisma.chatRoom.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            contractId: null,
          }),
        })
      );
      expect(mockPrisma.chatRoom.create).not.toHaveBeenCalled();
      expect(result.id).toBe('existing-room-id');
    });

    it('should create a new room when no existing room is found', async () => {
      mockPrisma.chatRoom.findMany.mockResolvedValue([]);
      const mockCreatedRoom = {
        id: 'new-room-id',
        contractId: null,
        participants: [
          { id: 'p1', userId: 'user-1' },
          { id: 'p2', userId: 'user-3' },
        ],
        messages: [],
      };
      mockPrisma.chatRoom.create.mockResolvedValue(mockCreatedRoom);

      const result = await service.createOrGetRoom('user-1', 'user-3');

      expect(mockPrisma.chatRoom.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            participants: {
              create: [{ userId: 'user-1' }, { userId: 'user-3' }],
            },
          }),
        })
      );
      expect(result.id).toBe('new-room-id');
    });
  });

  describe('saveMessage', () => {
    it('should save an encrypted message with IV in metadata and never store plaintext', async () => {
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
      expect(result.content).not.toContain('plaintext');
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
    it('should return encrypted messages for a participant in chronological order', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue({ id: 'cp-1' });
      const encryptedMessages = [
        {
          id: 'msg-1',
          roomId: 'room-1',
          content: 'ciphertext1==',
          metadata: { encrypted: true, iv: 'iv1' },
          createdAt: new Date('2026-01-01T10:00:00Z'),
          sender: { id: 'user-1', firstName: 'A', lastName: 'B', avatarUrl: null, role: 'EMPLOYER' },
        },
        {
          id: 'msg-2',
          roomId: 'room-1',
          content: 'ciphertext2==',
          metadata: { encrypted: true, iv: 'iv2' },
          createdAt: new Date('2026-01-01T10:01:00Z'),
          sender: { id: 'user-2', firstName: 'C', lastName: 'D', avatarUrl: null, role: 'FREELANCER' },
        },
      ];
      mockPrisma.message.findMany.mockResolvedValue(encryptedMessages);

      const result = await service.getRoomMessages('room-1', 'user-1');

      expect(mockPrisma.message.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { roomId: 'room-1' },
          orderBy: { createdAt: 'asc' },
        })
      );
      expect(result).toHaveLength(2);
      expect(result[0].content).toBe('ciphertext1==');
      expect(result[1].content).toBe('ciphertext2==');
    });

    it('should throw NotFoundException for a non-participant', async () => {
      mockPrisma.chatParticipant.findUnique.mockResolvedValue(null);

      await expect(service.getRoomMessages('room-1', 'intruder')).rejects.toThrow(NotFoundException);
    });
  });
});
