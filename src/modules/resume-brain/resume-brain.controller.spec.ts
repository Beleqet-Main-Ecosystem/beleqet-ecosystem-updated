import { Test, TestingModule } from '@nestjs/testing';
import { ResumeBrainController } from './resume-brain.controller';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';

describe('ResumeBrainController', () => {
  let controller: ResumeBrainController;
  let parser: { extractText: jest.Mock };

  beforeEach(async () => {
    parser = { extractText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResumeBrainController],
      providers: [
        ResumeBrainService,
        { provide: DocumentParserService, useValue: parser },
      ],
    }).compile();

    controller = module.get<ResumeBrainController>(ResumeBrainController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /resume-brain/health', () => {
    it('delegates to the service and returns the health payload', () => {
      expect(controller.health()).toEqual({
        status: 'ok',
        module: 'Resume Brain',
      });
    });
  });

  describe('POST /resume-brain/upload', () => {
    it('delegates the uploaded file to the service and returns its metadata', () => {
      const file: UploadedResumeFile = {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('dummy'),
      };
      expect(controller.upload(file)).toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
      });
    });
  });

  describe('POST /resume-brain/parse', () => {
    it('delegates the file to the service and returns metadata plus text', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nProduct Manager');
      const file: UploadedResumeFile = {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: Buffer.from('dummy'),
      };

      await expect(controller.parse(file)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        text: 'Jane Doe\nProduct Manager',
      });
    });
  });
});
