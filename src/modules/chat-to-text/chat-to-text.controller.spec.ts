import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request = require('supertest');
import { ChatToTextController } from './chat-to-text.controller';
import { ChatToTextService } from './chat-to-text.service';
import { SpeechTranscriptStatus } from '@prisma/client';

describe('ChatToTextController (Integration)', () => {
  let app: INestApplication;
  let chatToTextService: ChatToTextService;

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
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [ChatToTextController],
      providers: [
        {
          provide: ChatToTextService,
          useValue: {
            createConversation: jest.fn(),
            create: jest.fn(),
            transcribeAudio: jest.fn(),
            findById: jest.fn(),
            findByConversation: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getConversationHistory: jest.fn(),
            getStatistics: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    chatToTextService = moduleFixture.get<ChatToTextService>(ChatToTextService);
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /chat-to-text', () => {
    it('should create a new transcript', async () => {
      const createDto = {
        conversationId: 'conv_123',
        rawText: 'hello world',
        language: 'en',
      };

      jest.spyOn(chatToTextService, 'create').mockResolvedValue(mockTranscript);

      const response = await request(app.getHttpServer())
        .post('/chat-to-text')
        .send(createDto)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(chatToTextService.create).toHaveBeenCalledWith(createDto);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/chat-to-text')
        .send({ language: 'en' })
        .expect(400);
    });
  });

  describe('POST /chat-to-text/transcribe', () => {
    it('should reject an upload with no file attached', async () => {
      await request(app.getHttpServer())
        .post('/chat-to-text/transcribe')
        .field('conversationId', 'conv_123')
        .field('language', 'en')
        .expect(400);
    });

    it('should accept wav uploads when the browser reports a generic binary mimetype', async () => {
      jest.spyOn(chatToTextService, 'transcribeAudio').mockResolvedValue(mockTranscript);

      await request(app.getHttpServer())
        .post('/chat-to-text/transcribe')
        .attach('file', Buffer.from('RIFF\x00\x00\x00\x00WAVE'), {
          filename: 'sample.wav',
          contentType: 'application/octet-stream',
        })
        .field('conversationId', 'conv_123')
        .field('language', 'en')
        .expect(201);
    });
  });

  describe('GET /chat-to-text/:id', () => {
    it('should retrieve a transcript by id', async () => {
      jest.spyOn(chatToTextService, 'findById').mockResolvedValue(mockTranscript);

      const response = await request(app.getHttpServer())
        .get('/chat-to-text/transcript_123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(chatToTextService.findById).toHaveBeenCalledWith('transcript_123');
    });
  });
});
