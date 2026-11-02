import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';

// Minimal mock so jest doesn't try to connect to a real database
const mockPrismaService = {
  chatRoom: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn() },
  chatParticipant: { findUnique: jest.fn() },
  contract: { findUnique: jest.fn() },
  application: { findFirst: jest.fn() },
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

    const older = { id: 'msg-1', content: 'Hello', roomId: 'room-1' };
    const newer = { id: 'msg-2', content: 'World', roomId: 'room-1' };
    // The query reads newest first; the result is shown oldest first.
    mockPrismaService.message.findMany.mockResolvedValue([newer, older]);

    const result = await service.getRoomMessages('room-1', 'user-1');

    expect(mockPrismaService.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { roomId: 'room-1' } }),
    );
    expect(result).toEqual([older, newer]);
  });

  it('should throw NotFoundException when user is not a participant on getRoomMessages', async () => {
    mockPrismaService.chatParticipant.findUnique.mockResolvedValue(null);

    await expect(service.getRoomMessages('room-1', 'user-1')).rejects.toThrow(NotFoundException);
  });
});

describe('ChatService.createOrGetRoom', () => {
  let service: ChatService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [ChatService, { provide: PrismaService, useValue: mockPrismaService }],
    }).compile();
    service = module.get<ChatService>(ChatService);
    mockPrismaService.chatRoom.create.mockResolvedValue({ id: 'new-room' });
  });

  it('refuses a room with yourself', async () => {
    await expect(service.createOrGetRoom('u1', 'u1')).rejects.toThrow(BadRequestException);
  });

  it('refuses a contract room for someone outside the contract', async () => {
    mockPrismaService.contract.findUnique.mockResolvedValue({ clientId: 'u1', freelancerId: 'u2' });
    await expect(service.createOrGetRoom('u1', 'u3', 'c1')).rejects.toThrow(ForbiddenException);
    expect(mockPrismaService.chatRoom.create).not.toHaveBeenCalled();
  });

  it('refuses a direct room without an application between the two', async () => {
    mockPrismaService.application.findFirst.mockResolvedValue(null);
    await expect(service.createOrGetRoom('u1', 'u2')).rejects.toThrow(ForbiddenException);
  });

  it('reuses the existing direct room', async () => {
    mockPrismaService.application.findFirst.mockResolvedValue({ jobId: 'j1' });
    mockPrismaService.chatRoom.findFirst.mockResolvedValue({ id: 'old-room' });
    await expect(service.createOrGetRoom('u1', 'u2')).resolves.toEqual({ id: 'old-room' });
    expect(mockPrismaService.chatRoom.create).not.toHaveBeenCalled();
  });

  it('creates a direct room about the job applied to', async () => {
    mockPrismaService.application.findFirst.mockResolvedValue({ jobId: 'j1' });
    mockPrismaService.chatRoom.findFirst.mockResolvedValue(null);
    await service.createOrGetRoom('u1', 'u2');
    expect(mockPrismaService.chatRoom.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ jobId: 'j1', contractId: undefined }) }),
    );
  });
});
