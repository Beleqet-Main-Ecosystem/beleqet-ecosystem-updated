import { Test, TestingModule } from '@nestjs/testing';
import { RbacService } from './rbac.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role, User } from '@prisma/client';
import { I18nService } from 'nestjs-i18n';
import { AUDIT_LOGGER } from '../../common/interfaces/audit-logger.interface';
import { REDIS_CLIENT } from '../redis/redis.module';

describe('RbacService', () => {
  let service: RbacService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RbacService,
        {
          provide: PrismaService,
          useValue: {
            role: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            permission: {
              findUnique: jest.fn(),
              create: jest.fn(),
              findMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            eventLog: {
              create: jest.fn(),
            },
            $transaction: jest
              .fn()
              .mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => {
                return cb(prisma);
              }),
          },
        },
        {
          provide: I18nService,
          useValue: {
            t: jest.fn().mockImplementation((key: string) => `Translated: ${key}`),
          },
        },
        {
          provide: AUDIT_LOGGER,
          useValue: { log: jest.fn() },
        },
        {
          provide: REDIS_CLIENT,
          useValue: {
            del: jest.fn(),
            eval: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<RbacService>(RbacService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createRole', () => {
    it('should throw ConflictException if role already exists', async () => {
      jest
        .spyOn(prisma.role, 'findUnique')
        .mockResolvedValue({ id: '1', name: 'ADMIN' } as unknown as Role);

      await expect(service.createRole({ name: 'ADMIN' })).rejects.toThrow(ConflictException);
    });

    it('should create a role successfully', async () => {
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue(null);
      jest.spyOn(prisma.role, 'create').mockResolvedValue({
        id: '1',
        name: 'EMPLOYER',
      } as unknown as Role);

      const result = await service.createRole({ name: 'EMPLOYER' });
      expect(result.name).toEqual('EMPLOYER');
    });
  });

  describe('assignRoleToUser', () => {
    it('should throw NotFoundException if user not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue(null);
      await expect(service.assignRoleToUser('user1', 'role1')).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if role not found', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'user1' } as unknown as User);
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue(null);
      await expect(service.assignRoleToUser('user1', 'role1')).rejects.toThrow(NotFoundException);
    });

    it('should assign role to user', async () => {
      jest.spyOn(prisma.user, 'findUnique').mockResolvedValue({ id: 'user1' } as unknown as User);
      jest.spyOn(prisma.role, 'findUnique').mockResolvedValue({ id: 'role1' } as unknown as Role);
      jest.spyOn(prisma.user, 'update').mockResolvedValue({ id: 'user1' } as unknown as User);

      await service.assignRoleToUser('user1', 'role1');
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user1' },
        data: {
          rbacRoles: {
            connect: { id: 'role1' },
          },
        },
        include: { rbacRoles: true },
      });
    });
  });
});
