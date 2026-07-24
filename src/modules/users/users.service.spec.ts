import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('UsersService - Search Feature', () => {
  let service: UsersService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrismaService = {
      user: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'user-2', firstName: 'Alice', lastName: 'Smith', email: 'alice@test.com' }
        ]),
      }
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should return empty array if query is less than 2 characters', async () => {
    const result = await service.searchUsers('a', 'current-user-id');
    expect(result).toEqual([]);
    expect(prisma.user.findMany).not.toHaveBeenCalled();
  });

  it('should call prisma.user.findMany with correct query', async () => {
    const query = 'alice';
    const currentUserId = 'current-user-id';

    const result = await service.searchUsers(query, currentUserId);

    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        id: { not: currentUserId },
        OR: expect.arrayContaining([
          { firstName: { contains: query, mode: 'insensitive' } },
        ])
      }),
      take: 10,
    }));
    expect(result.length).toBe(1);
  });
});
