import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  UnsupportedMediaTypeException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import { ProfileMapperService } from './profile-mapper.service';
import { EMPTY_EXTRACTED_RESUME } from './dto/extracted-resume.dto';

// Valid magic-number headers so the Phase-11 content check passes by default.
const PDF_BYTES = Buffer.from('%PDF-1.5\n%dummy resume');
const DOCX_BYTES = Buffer.from('PK\x03\x04 dummy docx');

const makeFile = (over: Partial<UploadedResumeFile> = {}): UploadedResumeFile => ({
  originalname: 'resume.pdf',
  mimetype: 'application/pdf',
  size: 1024,
  buffer: PDF_BYTES,
  ...over,
});

const usage = { promptTokens: 12, completionTokens: 8, totalTokens: 20 };

describe('ResumeBrainService', () => {
  let service: ResumeBrainService;
  let parser: { extractText: jest.Mock };
  let aiExtractor: { extract: jest.Mock; providerName: string };
  let budget: { assertWithinBudget: jest.Mock; recordUsage: jest.Mock };
  let validator: { validate: jest.Mock };
  let mapper: { toUserProfile: jest.Mock };

  beforeEach(async () => {
    parser = { extractText: jest.fn() };
    aiExtractor = { extract: jest.fn(), providerName: 'fake' };
    budget = { assertWithinBudget: jest.fn(), recordUsage: jest.fn() };
    // Default: validator passes its input straight through.
    validator = { validate: jest.fn((x) => x) };
    mapper = { toUserProfile: jest.fn(() => ({})) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeBrainService,
        { provide: DocumentParserService, useValue: parser },
        { provide: AIExtractorService, useValue: aiExtractor },
        { provide: AiBudgetService, useValue: budget },
        { provide: ResumeValidatorService, useValue: validator },
        { provide: ProfileMapperService, useValue: mapper },
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
        buffer: DOCX_BYTES,
      });
      expect(service.describeUpload(file).filename).toBe('cv.docx');
    });

    it('rejects a legacy .doc file with 415 (parser cannot read binary .doc)', () => {
      const file = makeFile({
        originalname: 'cv.doc',
        mimetype: 'application/msword',
        buffer: Buffer.from('\xd0\xcf\x11\xe0 legacy doc'),
      });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('rejects a spoofed MIME type when the extension is not allowed', () => {
      // e.g. malware.exe with a forged Content-Type of application/pdf
      const file = makeFile({
        originalname: 'malware.exe',
        mimetype: 'application/pdf',
      });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('rejects a spoofed extension when the MIME type is not allowed', () => {
      // e.g. malware.pdf uploaded with its real executable MIME type
      const file = makeFile({
        originalname: 'malware.pdf',
        mimetype: 'application/x-msdownload',
      });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
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

    it('throws 415 when a .pdf name carries non-PDF content (magic-number mismatch)', () => {
      const file = makeFile({ buffer: Buffer.from('this is not a pdf at all') });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('throws 415 when a .docx name carries non-ZIP content', () => {
      const file = makeFile({
        originalname: 'cv.docx',
        mimetype:
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        buffer: Buffer.from('not a zip file'),
      });
      expect(() => service.describeUpload(file)).toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('throws 415 when the file is too small to carry a valid header', () => {
      // A <4-byte buffer used to skip the magic-number check entirely.
      const file = makeFile({ buffer: Buffer.from('%P') });
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

  describe('extractProfile', () => {
    it('parses the file, runs AI extraction and returns metadata + profile', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nEngineer');
      const profile = { ...EMPTY_EXTRACTED_RESUME, firstName: 'Jane' };
      aiExtractor.extract.mockResolvedValue({ resume: profile, usage });
      const userProfile = { firstName: 'Jane' };
      mapper.toUserProfile.mockReturnValue(userProfile);

      const file = makeFile();
      await expect(service.extractProfile(file, 'user-1')).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 1024,
        provider: 'fake',
        profile,
        userProfile,
      });
      expect(parser.extractText).toHaveBeenCalledWith(file);
      expect(aiExtractor.extract).toHaveBeenCalledWith('Jane Doe\nEngineer');
      expect(validator.validate).toHaveBeenCalledWith(profile);
      expect(mapper.toUserProfile).toHaveBeenCalledWith(profile);
    });

    it('checks the budget before the AI call and records usage after', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nEngineer');
      const profile = { ...EMPTY_EXTRACTED_RESUME, firstName: 'Jane' };
      aiExtractor.extract.mockResolvedValue({ resume: profile, usage });

      await service.extractProfile(makeFile(), 'user-1');

      expect(budget.assertWithinBudget).toHaveBeenCalledWith('user-1');
      expect(budget.recordUsage).toHaveBeenCalledWith('user-1', usage);
      // Budget must be asserted BEFORE money is spent on the provider.
      expect(budget.assertWithinBudget.mock.invocationCallOrder[0]).toBeLessThan(
        aiExtractor.extract.mock.invocationCallOrder[0],
      );
    });

    it('rejects with 429 and never calls the AI when the user is over budget', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nEngineer');
      budget.assertWithinBudget.mockRejectedValue(
        new HttpException('Daily limit reached', HttpStatus.TOO_MANY_REQUESTS),
      );

      await expect(
        service.extractProfile(makeFile(), 'user-1'),
      ).rejects.toMatchObject({ status: HttpStatus.TOO_MANY_REQUESTS });
      expect(aiExtractor.extract).not.toHaveBeenCalled();
      expect(budget.recordUsage).not.toHaveBeenCalled();
    });

    it('propagates a 400 raised by the validator (untrusted AI output)', async () => {
      parser.extractText.mockResolvedValue('some text');
      aiExtractor.extract.mockResolvedValue({
        resume: EMPTY_EXTRACTED_RESUME,
        usage,
      });
      validator.validate.mockImplementation(() => {
        throw new BadRequestException('Could not extract a usable profile.');
      });

      await expect(service.extractProfile(makeFile(), 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not call the AI when the type is unsupported (415)', async () => {
      const file = makeFile({ originalname: 'image.png', mimetype: 'image/png' });

      await expect(service.extractProfile(file, 'user-1')).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
      expect(aiExtractor.extract).not.toHaveBeenCalled();
      expect(budget.assertWithinBudget).not.toHaveBeenCalled();
    });
  });
});
