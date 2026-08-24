import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';

// Minimal mock so jest doesn't try to connect to a real database
const mockPrismaService = {
  chatRoom: { findUnique: jest.fn(), create: jest.fn() },
  chatParticipant: { findUnique: jest.fn() },
  message: { create: jest.fn(), findMany: jest.fn() },
};

describe('ChatService', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should save a message and return it', async () => {
    mockPrismaService.chatParticipant.findUnique.mockResolvedValue({
      id: 'participant-id',
    });

    const mockMessage = {
      id: 'message-id',
      content: 'Hello',
      roomId: 'room-1',
      senderId: 'user-1',
    };
    mockPrismaService.message.create.mockResolvedValue(mockMessage);

    const result = await service.saveMessage('room-1', 'user-1', 'Hello');

    expect(mockPrismaService.chatParticipant.findUnique).toHaveBeenCalledWith({
      where: { roomId_userId: { roomId: 'room-1', userId: 'user-1' } },
    });
    expect(mockPrismaService.message.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'Hello',
          roomId: 'room-1',
          senderId: 'user-1',
        }),
      }),
    );
    expect(result).toEqual(mockMessage);
  });

  it('should throw NotFoundException when user is not a participant on saveMessage', async () => {
    mockPrismaService.chatParticipant.findUnique.mockResolvedValue(null);

    await expect(service.saveMessage('room-1', 'user-1', 'Hello')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should return messages for a room', async () => {
    mockPrismaService.chatParticipant.findUnique.mockResolvedValue({
      id: 'participant-id',
    });

    const mockMessages = [
      { id: 'msg-1', content: 'Hello', roomId: 'room-1' },
      { id: 'msg-2', content: 'World', roomId: 'room-1' },
    ];
    mockPrismaService.message.findMany.mockResolvedValue(mockMessages);

    const result = await service.getRoomMessages('room-1', 'user-1');

    expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: 'room-1' } }),
    );
    expect(result).toEqual(mockMessages);
  });

  it('should throw NotFoundException when user is not a participant on getRoomMessages', async () => {
    mockPrismaService.chatParticipant.findUnique.mockResolvedValue(null);

    await expect(service.getRoomMessages('room-1', 'user-1')).rejects.toThrow(NotFoundException);
  });
});
