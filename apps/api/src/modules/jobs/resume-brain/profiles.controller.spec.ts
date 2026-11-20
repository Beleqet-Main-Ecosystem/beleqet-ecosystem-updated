import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { I18nService } from 'nestjs-i18n';
import { ProfilesController } from './profiles.controller';
import { ResumeBrainService } from './resume-brain.service';

const mockResumeBrainService = { autofillProfile: jest.fn() };
const mockI18nService = { t: jest.fn((key: string) => key) };
const mockUser = { userId: 'user-1', email: 'test@beleqet.com', role: 'JOB_SEEKER' };
const mockI18nContext = { lang: 'en' } as never;

describe('ProfilesController', () => {
  let controller: ProfilesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProfilesController],
      providers: [
        { provide: ResumeBrainService, useValue: mockResumeBrainService },
        { provide: I18nService, useValue: mockI18nService },
      ],
    }).compile();

    controller = module.get<ProfilesController>(ProfilesController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should apply the parsed resume to the caller’s own profile', async () => {
    mockResumeBrainService.autofillProfile.mockResolvedValue({ id: 'user-1', firstName: 'Selam' });

    const result = await controller.autofill(
      'user-1',
      { resumeId: 'resume-1' },
      mockUser,
      mockI18nContext,
    );

    expect(mockResumeBrainService.autofillProfile).toHaveBeenCalledWith(
      'user-1',
      'resume-1',
      'en',
      {
        personalInfo: undefined,
        skills: undefined,
      },
    );
    expect(result).toEqual({ id: 'user-1', firstName: 'Selam' });
  });

  it('should reject attempts to autofill another user’s profile', async () => {
    await expect(
      controller.autofill('other-user', { resumeId: 'resume-1' }, mockUser, mockI18nContext),
    ).rejects.toThrow(ForbiddenException);
    expect(mockResumeBrainService.autofillProfile).not.toHaveBeenCalled();
  });
});
