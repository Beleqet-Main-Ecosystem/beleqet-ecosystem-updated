import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';

import { ApplicationHelper } from '../../helpers/application.helper';

import { PrismaService } from '../../../../prisma/prisma.service';
import { I18nService } from 'nestjs-i18n';

describe('ApplicationHelper', () => {
  let helper: ApplicationHelper;

  const prismaMock = {
    application: {
      findUnique: jest.fn(),
    },
  };

  const i18nMock = {
    translate: jest.fn().mockResolvedValue('translated-message'),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationHelper,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },

        {
          provide: I18nService,
          useValue: i18nMock,
        },
      ],
    }).compile();

    helper = module.get<ApplicationHelper>(ApplicationHelper);
  });

  describe('validateInterviewApplication', () => {
    it('should return application when validation succeeds', async () => {
      const application = {
        id: 'application-1',

        userId: 'candidate-1',

        interview: null,

        job: {
          title: 'Backend Developer',

          company: {
            userId: 'employer-1',
          },
        },
      };

      prismaMock.application.findUnique.mockResolvedValue(application);

      const result = await helper.validateInterviewApplication('employer-1', 'application-1');

      expect(result).toEqual(application);

      expect(prismaMock.application.findUnique).toHaveBeenCalledWith({
        where: {
          id: 'application-1',
        },

        include: {
          user: true,

          interview: true,

          job: {
            include: {
              company: true,
            },
          },
        },
      });
    });

    it('should throw NotFoundException when application does not exist', async () => {
      prismaMock.application.findUnique.mockResolvedValue(null);

      await expect(
        helper.validateInterviewApplication('employer-1', 'invalid-application'),
      ).rejects.toThrow(NotFoundException);

      expect(i18nMock.translate).toHaveBeenCalledWith('interview.interview.applicationNotFound');
    });

    it('should throw ForbiddenException when employer does not own the job', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'application-1',

        userId: 'candidate-1',

        interview: null,

        job: {
          title: 'Frontend Developer',

          company: {
            userId: 'another-employer',
          },
        },
      });

      await expect(
        helper.validateInterviewApplication(
          'employer-1',

          'application-1',
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(i18nMock.translate).toHaveBeenCalledWith('interview.interview.forbidden');
    });

    it('should throw ConflictException when interview is already scheduled', async () => {
      prismaMock.application.findUnique.mockResolvedValue({
        id: 'application-1',

        userId: 'candidate-1',

        interview: {
          id: 'existing-interview',
        },

        job: {
          company: {
            userId: 'employer-1',
          },
        },
      });

      await expect(
        helper.validateInterviewApplication(
          'employer-1',

          'application-1',
        ),
      ).rejects.toThrow(ConflictException);

      expect(i18nMock.translate).toHaveBeenCalledWith('interview.interview.alreadyScheduled');
    });
  });
});
