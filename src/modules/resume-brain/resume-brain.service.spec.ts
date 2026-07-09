import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ResumeUploadStatus } from '@prisma/client';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeUploadFile } from './resume-upload-file.interface';

const mockPrismaService = {
  resumeUpload: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  parsedResume: {
    create: jest.fn(),
    findUnique: jest.fn(),
  },
  eventLog: { create: jest.fn() },
  $transaction: jest.fn(),
};
mockPrismaService.$transaction.mockImplementation((callback: (tx: unknown) => unknown) =>
  callback(mockPrismaService),
);

const mockUploadsService = {
  uploadFile: jest.fn(() =>
    Promise.resolve({
      publicUrl: 'https://storage.example.com/resumes/file.pdf',
      key: 'resumes/file.pdf',
    }),
  ),
  deleteFile: jest.fn(() => Promise.resolve()),
};

const mockUsersService = { update: jest.fn() };

const mockParsingService = {
  parse: jest.fn(() => Promise.resolve({ text: 'raw cv text', usedOcrFallback: false })),
};

const mockExtractionProvider = {
  engineId: 'mock',
  extract: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string, fallback?: unknown) => {
    const values: Record<string, unknown> = {
      RESUME_MAX_FILE_SIZE_MB: 10,
      RESUME_PARSE_TIMEOUT_MS: 30000,
    };
    return values[key] ?? fallback;
  }),
};

const mockI18n = { t: jest.fn((key: string) => key) };

function buildService(): ResumeBrainService {
  return new ResumeBrainService(
    mockPrismaService as never,
    mockUploadsService as never,
    mockUsersService as never,
    mockParsingService as never,
    mockExtractionProvider as never,
    mockConfig as unknown as ConfigService,
    mockI18n as never,
  );
}

const validExtraction = {
  personalInfo: {
    fullName: 'Selam Tesfaye',
    email: 'selam@example.com',
    phone: '+251911223344',
    location: null,
  },
  education: [],
  workExperience: [],
  skills: ['TypeScript'],
  certifications: [],
  languages: [],
};

describe('ResumeBrainService', () => {
  let service: ResumeBrainService;
  const pdfFile: ResumeUploadFile = {
    buffer: Buffer.from('%PDF-1.4 fake'),
    originalname: 'my resume (final).pdf',
    mimetype: 'application/pdf',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = buildService();
    mockPrismaService.resumeUpload.create.mockResolvedValue({
      id: 'upload-1',
      userId: 'user-1',
      status: ResumeUploadStatus.PARSING,
    });
    mockParsingService.parse.mockResolvedValue({ text: 'raw cv text', usedOcrFallback: false });
    mockExtractionProvider.extract.mockResolvedValue(validExtraction);
    mockPrismaService.parsedResume.create.mockResolvedValue({ id: 'parsed-1', ...validExtraction });
  });

  describe('uploadAndProcess', () => {
    it('should reject an unsupported mime type', async () => {
      const badFile = { ...pdfFile, mimetype: 'image/png' };
      await expect(service.uploadAndProcess('user-1', badFile, true)).rejects.toThrow(
        UnsupportedMediaTypeException,
      );
    });

    it('should reject a missing file', async () => {
      await expect(
        service.uploadAndProcess('user-1', undefined as unknown as ResumeUploadFile, true),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject a file exceeding the configured max size', async () => {
      const bigFile = { ...pdfFile, buffer: Buffer.alloc(11 * 1024 * 1024) };
      await expect(service.uploadAndProcess('user-1', bigFile, true)).rejects.toThrow(
        PayloadTooLargeException,
      );
    });

    it('should sanitize the filename before storing it', async () => {
      await service.uploadAndProcess('user-1', pdfFile, true);

      const uploadedArg = (mockUploadsService.uploadFile as jest.Mock).mock.calls[0][0] as {
        originalname: string;
      };
      expect(uploadedArg.originalname).toBe('my_resume__final_.pdf');
    });

    it('should persist the parsed resume and mark the upload PARSED on success', async () => {
      const result = await service.uploadAndProcess('user-1', pdfFile, true);

      expect(mockPrismaService.parsedResume.create).toHaveBeenCalled();
      expect(mockPrismaService.resumeUpload.update).toHaveBeenCalledWith({
        where: { id: 'upload-1' },
        data: { status: ResumeUploadStatus.PARSED },
      });
      expect(result.upload.status).toBe(ResumeUploadStatus.PARSED);
    });

    it('should mark the upload FAILED and rethrow when extraction yields no data', async () => {
      mockExtractionProvider.extract.mockResolvedValue({
        personalInfo: {},
        education: [],
        workExperience: [],
        skills: [],
        certifications: [],
        languages: [],
      });

      await expect(service.uploadAndProcess('user-1', pdfFile, true)).rejects.toThrow(
        BadRequestException,
      );
      expect(mockPrismaService.resumeUpload.update).toHaveBeenCalledWith({
        where: { id: 'upload-1' },
        data: expect.objectContaining({ status: ResumeUploadStatus.FAILED }),
      });
    });
  });

  describe('getResume', () => {
    it('should throw NotFoundException when the resume does not exist', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue(null);
      await expect(service.getResume('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the resume belongs to another user', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'someone-else',
      });
      await expect(service.getResume('user-1', 'r1')).rejects.toThrow(ForbiddenException);
    });

    it('should return the resume when owned by the requesting user', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue({ id: 'r1', userId: 'user-1' });
      const result = await service.getResume('user-1', 'r1');
      expect(result).toEqual({ id: 'r1', userId: 'user-1' });
    });
  });

  describe('deleteResume', () => {
    it('should throw NotFoundException when the resume does not exist', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue(null);
      await expect(service.deleteResume('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the resume belongs to another user', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'someone-else',
      });
      await expect(service.deleteResume('user-1', 'r1')).rejects.toThrow(ForbiddenException);
    });

    it('should delete the stored file and the database record', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'user-1',
        storageKey: 'resumes/file.pdf',
      });

      await service.deleteResume('user-1', 'r1');

      expect(mockUploadsService.deleteFile).toHaveBeenCalledWith('resumes/file.pdf');
      expect(mockPrismaService.resumeUpload.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });

    it('should still delete the database record even if file deletion fails', async () => {
      mockPrismaService.resumeUpload.findUnique.mockResolvedValue({
        id: 'r1',
        userId: 'user-1',
        storageKey: 'resumes/file.pdf',
      });
      mockUploadsService.deleteFile.mockRejectedValueOnce(new Error('storage unavailable'));

      await service.deleteResume('user-1', 'r1');

      expect(mockPrismaService.resumeUpload.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });
  });

  describe('autofillProfile', () => {
    it('should throw NotFoundException when the parsed resume does not exist', async () => {
      mockPrismaService.parsedResume.findUnique.mockResolvedValue(null);
      await expect(service.autofillProfile('user-1', 'missing')).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException when the parsed resume belongs to another user', async () => {
      mockPrismaService.parsedResume.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'someone-else',
      });
      await expect(service.autofillProfile('user-1', 'p1')).rejects.toThrow(ForbiddenException);
    });

    it('should split fullName into first/last name and apply skills to the profile', async () => {
      mockPrismaService.parsedResume.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        personalInfo: {
          fullName: 'Selam Tesfaye',
          phone: '+251911223344',
          location: 'Addis Ababa',
        },
        skills: ['TypeScript', 'NestJS'],
      });
      mockUsersService.update.mockResolvedValue({
        id: 'user-1',
        firstName: 'Selam',
        lastName: 'Tesfaye',
      });

      const result = await service.autofillProfile('user-1', 'p1');

      expect(mockUsersService.update).toHaveBeenCalledWith('user-1', {
        firstName: 'Selam',
        lastName: 'Tesfaye',
        phone: '+251911223344',
        location: 'Addis Ababa',
        skills: ['TypeScript', 'NestJS'],
      });
      expect(result).toEqual({ id: 'user-1', firstName: 'Selam', lastName: 'Tesfaye' });
    });

    it('should omit fields that are missing from the parsed personal info', async () => {
      mockPrismaService.parsedResume.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        personalInfo: { fullName: null, phone: null, location: null },
        skills: [],
      });

      await service.autofillProfile('user-1', 'p1');

      expect(mockUsersService.update).toHaveBeenCalledWith('user-1', {});
    });

    it('should apply caller-supplied overrides instead of the originally stored values', async () => {
      mockPrismaService.parsedResume.findUnique.mockResolvedValue({
        id: 'p1',
        userId: 'user-1',
        personalInfo: { fullName: 'Original Name', phone: '111', location: 'Original City' },
        skills: ['OriginalSkill'],
      });

      await service.autofillProfile('user-1', 'p1', 'en', {
        personalInfo: { fullName: 'Corrected Name', phone: '222', location: 'Corrected City' },
        skills: ['CorrectedSkill'],
      });

      expect(mockUsersService.update).toHaveBeenCalledWith('user-1', {
        firstName: 'Corrected',
        lastName: 'Name',
        phone: '222',
        location: 'Corrected City',
        skills: ['CorrectedSkill'],
      });
    });
  });
});
