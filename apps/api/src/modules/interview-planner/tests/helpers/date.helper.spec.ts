import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';

import { DateHelper } from '../../helpers/date.helper';
import { I18nService } from 'nestjs-i18n';

describe('DateHelper', () => {
  let helper: DateHelper;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        DateHelper,

        {
          provide: I18nService,
          useValue: {
            translate: jest.fn().mockResolvedValue('invalid range'),
          },
        },
      ],
    }).compile();

    helper = module.get(DateHelper);
  });

  it('should accept valid range', async () => {
    await expect(
      helper.validateRange(new Date('2026-07-10T09:00:00Z'), new Date('2026-07-10T10:00:00Z')),
    ).resolves.not.toThrow();
  });

  it('should reject invalid range', async () => {
    await expect(
      helper.validateRange(new Date('2026-07-10T10:00:00Z'), new Date('2026-07-10T09:00:00Z')),
    ).rejects.toThrow(BadRequestException);
  });
});
