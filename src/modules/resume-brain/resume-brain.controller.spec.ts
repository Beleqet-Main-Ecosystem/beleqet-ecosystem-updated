import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ResumeBrainController } from './resume-brain.controller';
import { ResumeBrainService, UploadedResumeFile } from './resume-brain.service';
import { DocumentParserService } from './document-parser.service';
import { AIExtractorService } from './ai-extractor.service';
import { AiBudgetService } from './ai-budget.service';
import { ResumeValidatorService } from './resume-validator.service';
import { ProfileMapperService } from './profile-mapper.service';
import { EMPTY_EXTRACTED_RESUME } from './dto/extracted-resume.dto';
import { CurrentUserPayload } from '../../common/decorators/current-user.decorator';

// Valid PDF magic number so the service's content check passes.
const PDF_BYTES = Buffer.from('%PDF-1.5\n%dummy resume');
const CURRENT_USER: CurrentUserPayload = {
  userId: 'user-1',
  email: 'jane@example.com',
  role: 'JOB_SEEKER',
};

describe('ResumeBrainController', () => {
  let controller: ResumeBrainController;
  let parser: { extractText: jest.Mock };
  let aiExtractor: { extract: jest.Mock; providerName: string };
  let budget: { assertWithinBudget: jest.Mock; recordUsage: jest.Mock };
  let validator: { validate: jest.Mock };
  let mapper: { toUserProfile: jest.Mock };

  beforeEach(async () => {
    parser = { extractText: jest.fn() };
    aiExtractor = { extract: jest.fn(), providerName: 'fake' };
    budget = { assertWithinBudget: jest.fn(), recordUsage: jest.fn() };
    validator = { validate: jest.fn((x) => x) };
    mapper = { toUserProfile: jest.fn(() => ({})) };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResumeBrainController],
      providers: [
        ResumeBrainService,
        { provide: DocumentParserService, useValue: parser },
        { provide: AIExtractorService, useValue: aiExtractor },
        { provide: AiBudgetService, useValue: budget },
        { provide: ResumeValidatorService, useValue: validator },
        { provide: ProfileMapperService, useValue: mapper },
      ],
    })
      // Guard behaviour is exercised at the app level; here we call handlers
      // directly, so stub the rate-limit guard rather than wiring ThrottlerModule.
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true })
      .compile();

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
        buffer: PDF_BYTES,
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
        buffer: PDF_BYTES,
      };

      await expect(controller.parse(file)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        text: 'Jane Doe\nProduct Manager',
      });
    });
  });

  describe('POST /resume-brain/extract', () => {
    it('delegates the file + user to the service and returns metadata plus the profile', async () => {
      parser.extractText.mockResolvedValue('Jane Doe\nProduct Manager');
      const profile = { ...EMPTY_EXTRACTED_RESUME, firstName: 'Jane' };
      aiExtractor.extract.mockResolvedValue({
        resume: profile,
        usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      });
      const userProfile = { firstName: 'Jane' };
      mapper.toUserProfile.mockReturnValue(userProfile);

      const file: UploadedResumeFile = {
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        buffer: PDF_BYTES,
      };

      await expect(controller.extract(file, CURRENT_USER)).resolves.toEqual({
        filename: 'resume.pdf',
        mimetype: 'application/pdf',
        size: 2048,
        provider: 'fake',
        profile,
        userProfile,
      });
      // The authenticated user's id must reach the budget guard.
      expect(budget.assertWithinBudget).toHaveBeenCalledWith('user-1');
    });
  });
});
