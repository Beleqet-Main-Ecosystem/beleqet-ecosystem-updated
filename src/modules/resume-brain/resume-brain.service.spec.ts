import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';

const makeFile = (over: Partial<UploadedResumeFile> = {}): UploadedResumeFile => ({
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: Buffer.from('dummy'),
  ...over,
});

describe('ResumeBrainService', () => {
  let service: ResumeBrainService;
  let parser: { extractText: jest.Mock };

  beforeEach(async () => {
    parser = { extractText: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBrainService,
        { provide: DocumentParserService, useValue: parser },
      ],
    }).compile();

    service = module.get<ResumeBrainService>(ResumeBrainService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('health', () => {
    it('returns an ok status for the Resume Brain module', () => {
      expect(service.health()).toEqual({
        status: 'ok',
        module: 'Resume Brain',
      });
    });
  });

  describe('describeUpload', () => {
    it('returns filename, mimetype and size for a valid PDF', () => {
      const file = makeFile();
      expect(service.describeUpload(file)).toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
      });
    });

    it('accepts a .docx file', () => {
      const file = makeFile({
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
      expect(service.describeUpload(file).filename).toBe('cv.docx');
    });

    it('accepts a legacy .doc file', () => {
      const file = makeFile({
        originalname: 'cv.doc',
        mimetype: 'application/msword',
      });
      expect(service.describeUpload(file).filename).toBe('cv.doc');
    });

    it('accepts a file with a valid extension even if the MIME type is generic', () => {
      const file = makeFile({
        originalname: 'resume.pdf',
        mimetype: 'application/octet-stream',
      });
      expect(service.describeUpload(file).filename).toBe('resume.pdf');
    });

    it('throws 400 when no file is provided', () => {
      expect(() => service.describeUpload(undefined)).toThrow(BadRequestException);
    });

    it('throws 415 for an unsupported type (image/png)', () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });
  });

  describe('parseResume', () => {
    it('returns upload metadata plus the extracted text', async () => {
      parser.extractText.mockResolvedValue('John Doe\nSoftware Engineer');
      const file = makeFile();

      await expect(service.parseResume(file)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        text: 'John Doe\nSoftware Engineer',
      });
      expect(parser.extractText).toHaveBeenCalledWith(file);
    });

    it('rejects with 415 before parsing when the type is unsupported', async () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });

      await expect(service.parseResume(file)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(parser.extractText).not.toHaveBeenCalled();
    });

    it('rejects with 400 when no file is provided', async () => {
      await expect(service.parseResume(undefined)).rejects.toThrow(
        BadRequestException,
      );
      expect(parser.extractText).not.toHaveBeenCalled();
    });

    it('propagates a 422 raised by the parser', async () => {
      parser.extractText.mockRejectedValue(
        new UnprocessableEntityException('No readable text found in the document.'),
      );

      await expect(service.parseResume(makeFile())).rejects.toThrow(
        UnprocessableEntityException,
      );
    });
  });
});
