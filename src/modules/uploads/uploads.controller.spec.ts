import { Test, TestingModule } from '@nestjs/testing';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

const mockUploadsService = {
  generatePresignedUrl: jest.fn().mockResolvedValue({
    presignedUrl: 'https://s3.example.com/presigned',
    publicUrl: 'https://cdn.example.com/public',
    key: 'misc/test-file.pdf',
  }),
  uploadFile: jest.fn().mockResolvedValue({
    publicUrl: 'https://cdn.example.com/resumes/file.webp',
    key: 'resumes/file.webp',
    optimized: true,
  }),
};

describe('UploadsController', () => {
  let controller: UploadsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UploadsController],
      providers: [{ provide: UploadsService, useValue: mockUploadsService }],
    }).compile();

    controller = module.get<UploadsController>(UploadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('uses default folder and parsed language when creating presigned URL', async () => {
    await controller.getPresignedUrl(
      {
        filename: 'avatar.png',
        contentType: 'image/png',
      },
      'en-US,en;q=0.9',
    );

    expect(mockUploadsService.generatePresignedUrl).toHaveBeenCalledWith(
      'avatar.png',
      'image/png',
      'misc',
      'en-US',
    );
  });
});
