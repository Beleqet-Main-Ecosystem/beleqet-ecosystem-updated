import { Test, TestingModule } from '@nestjs/testing';
import { ChatService } from './chat.service';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';

// Minimal mock so jest doesn't try to connect to a real database
const mockPrismaService = {
  chatRoom: { findUnique: jest.fn(), create: jest.fn() },
  chatParticipant: { findUnique: jest.fn() },
  message: { create: jest.fn(), findMany: jest.fn() },
};

const mockEncryptionService = {
  encrypt: jest.fn((text) => `encrypted-${text}`),
  decrypt: jest.fn((text) => `decrypted-${text}`),
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
        {
          provide: EncryptionService,
          useValue: mockEncryptionService,
        },
      ],
    }).compile();

    service = module.get<ChatService>(ChatService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });


  it('should encrypt message before saving', async () => {

    mockPrismaService.chatParticipant.findUnique.mockResolvedValue({
      id: 'participant-id',
    });

    mockPrismaService.message.create.mockResolvedValue({
      id: 'message-id',
      content: 'encrypted-Hello',
    });


    await service.saveMessage(
      'room-1',
      'user-1',
      'Hello',
    );


    expect(
      mockEncryptionService.encrypt,
    ).toHaveBeenCalledWith('Hello');


    expect(
      mockPrismaService.message.create,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          content: 'encrypted-Hello',
        }),
      }),
    );
  });

  it('should decrypt messages when fetching history', async () => {

    mockPrismaService.chatParticipant.findUnique
      .mockResolvedValue({
        id: 'participant-id',
      });


    mockPrismaService.message.findMany
      .mockResolvedValue([
        {
          id: 'msg-1',
          content: 'encrypted-Hello',
        },
      ]);


    const result = await service.getRoomMessages(
      'room-1',
      'user-1',
    );


    expect(
      mockEncryptionService.decrypt,
    ).toHaveBeenCalledWith(
      'encrypted-Hello',
    );


    expect(result[0].content)
      .toBe('decrypted-encrypted-Hello');
  });

});


