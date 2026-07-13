import { Test, TestingModule } from '@nestjs/testing';
import { ResumeBrainController } from './resume-brain.controller';
import { ResumeBrainService } from './resume-brain.service';
import { ResumeUploadFile } from './resume-upload-file.interface';

const mockResumeBrainService = {
  uploadAndProcess: jest.fn(),
  getResume: jest.fn(),
  deleteResume: jest.fn(),
};

const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'JOB_SEEKER' };
const mockI18nContext = { lang: 'en' } as never;

describe('ResumeBrainController', () => {
  let controller: ResumeBrainController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ResumeBrainController],
      providers: [{ provide: ResumeBrainService, useValue: mockResumeBrainService }],
    }).compile();

    controller = module.get<ResumeBrainController>(ResumeBrainController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('upload', () => {
    it('should delegate to the service with the current user id and consent flag', async () => {
      const file: ResumeUploadFile = {
        buffer: Buffer.from('pdf'),
        originalname: 'resume.pdf',
        mimetype: 'application/pdf',
      };
      mockResumeBrainService.uploadAndProcess.mockResolvedValue({ upload: { id: 'u1' } });

      const result = await controller.upload(file, { consent: true }, mockUser, mockI18nContext);

      expect(mockResumeBrainService.uploadAndProcess).toHaveBeenCalledWith(
        'user-1',
        file,
        true,
        'en',
      );
      expect(result).toEqual({ upload: { id: 'u1' } });
    });
  });

  describe('getById', () => {
    it('should delegate to the service with the current user id', async () => {
      mockResumeBrainService.getResume.mockResolvedValue({ id: 'r1' });

      const result = await controller.getById('r1', mockUser, mockI18nContext);

      expect(mockResumeBrainService.getResume).toHaveBeenCalledWith('user-1', 'r1', 'en');
      expect(result).toEqual({ id: 'r1' });
    });
  });

  describe('remove', () => {
    it('should delegate to the service with the current user id', async () => {
      await controller.remove('r1', mockUser, mockI18nContext);

      expect(mockResumeBrainService.deleteResume).toHaveBeenCalledWith('user-1', 'r1', 'en');
    });
  });
});
