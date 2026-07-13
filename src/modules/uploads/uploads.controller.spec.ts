import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const mockUploadsService = {
  generateUploadUrl: jest.fn().mockResolvedValue({
    uploadUrl: 'https://s3.example.com/presigned',
    publicUrl: 'https://s3.example.com/public',
    key: 'misc/test-file.pdf',
  }),
};

describe('UploadsController', () => {
  let controller: UploadsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [
        {
          provide: UploadsService,
          useValue: mockUploadsService,
        },
      ],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getPresignedUrl', () => {
    it('should generate a secure upload URL', async () => {
      const dto = {
        filename: 'test-file.pdf',
        contentType: 'application/pdf',
        folder: 'documents',
      };

      const result = await controller.getPresignedUrl(dto);

      expect(result).toEqual({
        uploadUrl: 'https://s3.example.com/presigned',
        publicUrl: 'https://s3.example.com/public',
        key: 'misc/test-file.pdf',
      });

      expect(mockUploadsService.generateUploadUrl).toHaveBeenCalledWith(
        'test-file.pdf',
        'application/pdf',
        'documents',
      );
    });
  });
});
