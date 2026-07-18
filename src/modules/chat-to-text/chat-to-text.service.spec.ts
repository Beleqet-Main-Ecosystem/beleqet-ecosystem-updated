import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ChatToTextService } from './chat-to-text.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FasterWhisperService } from './faster-whisper.service';
import { CreateTranscriptDto } from './dtos';
import { Prisma, SpeechTranscriptStatus } from '@prisma/client';

describe('ChatToTextService', () => {
  let service: ChatToTextService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
    },
    speechConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    speechTranscript: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockFasterWhisperService = {
    transcribe: jest.fn(),
  };

  const mockConversation = {
    id: 'conv_123',
    userId: 'user_123',
    title: 'Test Conversation',
    description: 'Test',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTranscript = {
    id: 'transcript_123',
    conversationId: 'conv_123',
    audioUrl: 'https://example.com/audio.mp3',
    videoUrl: null,
    duration: 5000,
    rawText: 'hello world',
    normalizedText: 'Hello world.',
    language: 'en',
    confidence: 0.95,
    provider: 'web-speech-api',
    processingTime: 2000,
    status: SpeechTranscriptStatus.COMPLETED,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatToTextService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: FasterWhisperService, useValue: mockFasterWhisperService },
      ],
    }).compile();

    service = module.get<ChatToTextService>(ChatToTextService);
    jest.clearAllMocks();
  });

  describe('createConversation', () => {
    it('should create a conversation without a user relation when the requested user does not exist', async () => {
      const createDto: CreateTranscriptDto = {
        conversationId: 'conv_123',
        rawText: 'hello world',
        language: 'en',
      };

      mockPrismaService.user.findUnique.mockResolvedValue(null);
      mockPrismaService.speechConversation.create.mockResolvedValue({
        ...mockConversation,
        userId: null,
      });

      const result = await service.createConversation({
        title: 'Local smoke test',
        description: 'Test',
        userId: '123e4567-e89b-12d3-a456-426614174000',
      });

      expect(result.userId).toBeNull();
      expect(mockPrismaService.speechConversation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Local smoke test',
            userId: null,
          }),
        }),
      );
    });
  });

  describe('create', () => {
    it('should successfully create a transcript', async () => {
      const createDto: CreateTranscriptDto = {
        conversationId: 'conv_123',
        rawText: 'hello world',
        language: 'en',
      };

      mockPrismaService.speechConversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.speechTranscript.create.mockResolvedValue(mockTranscript);

      const result = await service.create(createDto);

      expect(result).toEqual(mockTranscript);
      expect(mockPrismaService.speechConversation.findUnique).toHaveBeenCalledWith({
        where: { id: 'conv_123' },
        select: { id: true },
      });
      expect(mockPrismaService.speechTranscript.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            messages: expect.objectContaining({
              create: expect.objectContaining({ content: 'Hello world.' }),
            }),
          }),
        }),
      );
    });

    it('should throw NotFoundException if conversation does not exist', async () => {
      mockPrismaService.speechConversation.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ conversationId: 'invalid_conv', rawText: 'hello world' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should fall back to a placeholder transcript when the text is empty or very short', async () => {
      mockPrismaService.speechConversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.speechTranscript.create.mockResolvedValue(mockTranscript);

      await expect(service.create({ conversationId: 'conv_123', rawText: 'You' })).resolves.toEqual(
        mockTranscript,
      );
      expect(mockPrismaService.speechTranscript.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            normalizedText: 'No speech detected.',
            messages: expect.objectContaining({
              create: expect.objectContaining({ content: 'No speech detected.' }),
            }),
          }),
        }),
      );
    });
  });

  describe('delete', () => {
    it('should throw NotFoundException when a transcript is already missing', async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError(
        'Record to delete does not exist',
        { code: 'P2025', clientVersion: 'test' },
      );
      mockPrismaService.speechTranscript.delete.mockRejectedValue(prismaError);

      await expect(service.delete('missing_id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findById', () => {
    it('should find transcript by id', async () => {
      mockPrismaService.speechTranscript.findUnique.mockResolvedValue(mockTranscript);

      const result = await service.findById('transcript_123');

      expect(result).toEqual(mockTranscript);
    });

    it('should throw NotFoundException if transcript does not exist', async () => {
      mockPrismaService.speechTranscript.findUnique.mockResolvedValue(null);

      await expect(service.findById('invalid_id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getStatistics', () => {
    it('should calculate conversation statistics', async () => {
      const transcripts = [
        { ...mockTranscript, status: SpeechTranscriptStatus.COMPLETED, duration: 5000 },
        {
          ...mockTranscript,
          id: 'transcript_124',
          status: SpeechTranscriptStatus.COMPLETED,
          duration: 3000,
        },
        {
          ...mockTranscript,
          id: 'transcript_125',
          status: SpeechTranscriptStatus.FAILED,
          duration: undefined,
        },
      ];

      mockPrismaService.speechTranscript.findMany.mockResolvedValue(transcripts);

      const result = await service.getStatistics('conv_123');

      expect(result).toEqual({
        totalTranscripts: 3,
        completedTranscripts: 2,
        failedTranscripts: 1,
        pendingTranscripts: 0,
        processingTranscripts: 0,
        totalDuration: 8000,
        languages: ['en'],
      });
    });
  });

  describe('transcribeAudio', () => {
    it('should transcribe locally and persist the normalized transcript', async () => {
      mockFasterWhisperService.transcribe.mockResolvedValue({
        text: '  hello from audio  ',
      });
      mockPrismaService.speechConversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.speechTranscript.create.mockResolvedValue(mockTranscript);

      const result = await service.transcribeAudio(
        {
          buffer: Buffer.from('audio bytes'),
          mimetype: 'audio/webm',
          originalname: 'recording.webm',
          size: 11,
        },
        { conversationId: 'conv_123', language: 'en' },
      );

      expect(result).toEqual(mockTranscript);
      expect(mockPrismaService.speechTranscript.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            normalizedText: 'Hello from audio.',
            provider: 'faster-whisper',
          }),
        }),
      );
    });
  });

  describe('transcribeChunk', () => {
    it('should transcribe an incoming stream chunk and persist it as a transcript', async () => {
      mockFasterWhisperService.transcribe.mockResolvedValue({ text: '  live chunk  ' });
      mockPrismaService.speechConversation.findUnique.mockResolvedValue(mockConversation);
      mockPrismaService.speechTranscript.create.mockResolvedValue(mockTranscript);

      const result = await service.transcribeChunk(
        {
          buffer: Buffer.from('chunk bytes'),
          mimetype: 'audio/webm',
          originalname: 'chunk.webm',
          size: 11,
        },
        { conversationId: 'conv_123', language: 'en' },
      );

      expect(result).toEqual(mockTranscript);
      expect(mockPrismaService.speechTranscript.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            normalizedText: 'Live chunk.',
            provider: 'faster-whisper',
          }),
        }),
      );
    });
  });
});
