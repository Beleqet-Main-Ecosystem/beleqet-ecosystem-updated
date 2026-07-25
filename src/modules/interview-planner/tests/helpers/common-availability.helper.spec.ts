import { Test } from '@nestjs/testing';

import { CommonAvailabilityHelper } from '../../helpers/common-availability.helper';

import { PrismaService } from '../../../../prisma/prisma.service';

describe('CommonAvailabilityHelper', () => {
  let helper: CommonAvailabilityHelper;

  const prismaMock = {
    userAvailability: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CommonAvailabilityHelper,

        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    helper = module.get(CommonAvailabilityHelper);
  });

  it('should find overlapping availability', async () => {
    prismaMock.userAvailability.findMany

      .mockResolvedValueOnce([
        {
          startTime: new Date('2026-07-10T10:00:00Z'),
          endTime: new Date('2026-07-10T12:00:00Z'),
          timezone: 'UTC',
        },
      ])

      .mockResolvedValueOnce([
        {
          startTime: new Date('2026-07-10T11:00:00Z'),
          endTime: new Date('2026-07-10T13:00:00Z'),
          timezone: 'UTC',
        },
      ]);

    const result = await helper.findCommonAvailability('employer', 'candidate');

    expect(result[0].startTime).toEqual(new Date('2026-07-10T11:00:00Z'));

    expect(result[0].endTime).toEqual(new Date('2026-07-10T12:00:00Z'));
  });
});
