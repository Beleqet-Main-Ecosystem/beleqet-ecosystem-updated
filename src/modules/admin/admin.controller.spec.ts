import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from './admin.controller';
import { PrismaService } from '../../prisma/prisma.service';
import { getQueueToken } from '@nestjs/bull';
import { ChatService } from '../chat/chat.service';

const mockPrisma = {
  user: { findMany: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
  contactMessage: { findMany: jest.fn(), update: jest.fn() },
  notification: { createMany: jest.fn() },
  dispute: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  chatRoom: { findUnique: jest.fn() },
  message: { findMany: jest.fn() },
  userTwoFactor: { findUnique: jest.fn() },
};

const mockNotificationsQueue = { add: jest.fn().mockResolvedValue({}) };
const mockChatService = {};

describe('AdminController', () => {
  let controller: AdminController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: getQueueToken('notifications'), useValue: mockNotificationsQueue },
        { provide: ChatService, useValue: mockChatService },
      ],
    }).compile();
    controller = module.get<AdminController>(AdminController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getUsers', () => {
    it('should return users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'u@t.com' }]);
      const result = await controller.getUsers();
      expect(result).toHaveLength(1);
    });
  });

  describe('createUser', () => {
    it('should create a user', async () => {
      mockPrisma.user.create.mockResolvedValue({ id: 'u1', email: 'u@t.com' });
      const result = await controller.createUser({
        email: 'u@t.com', firstName: 'John', lastName: 'Doe', password: 'password123', role: 'JOB_SEEKER' as any,
      });
      expect(result.id).toBe('u1');
    });
  });

  describe('updateUser', () => {
    it('should update a user', async () => {
      mockPrisma.user.update.mockResolvedValue({ id: 'u1', firstName: 'Jane' });
      const result = await controller.updateUser('u1', { firstName: 'Jane' });
      expect(result.firstName).toBe('Jane');
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      mockPrisma.user.delete.mockResolvedValue({});
      const result = await controller.deleteUser('u1', { userId: 'admin-1', email: 'a@t.com', role: 'ADMIN' });
      expect(result.deleted).toBe(true);
    });

    it('should not allow admin to delete themselves', async () => {
      const result = await controller.deleteUser('admin-1', { userId: 'admin-1', email: 'a@t.com', role: 'ADMIN' });
      expect(result.deleted).toBe(false);
    });
  });

  describe('getContacts', () => {
    it('should return contacts', async () => {
      mockPrisma.contactMessage.findMany.mockResolvedValue([]);
      const result = await controller.getContacts();
      expect(result).toEqual([]);
    });
  });

  describe('broadcast', () => {
    it('should broadcast a notification', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 'u1', email: 'u@t.com', firstName: 'John' }]);
      mockPrisma.notification.createMany.mockResolvedValue({ count: 1 });
      const result = await controller.broadcast({ title: 'Test', body: 'Hello everyone', userIds: ['u1'] });
      expect(result.delivered).toBe(1);
    });

    it('should return delivered: 0 if no users found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      const result = await controller.broadcast({ title: 'Test', body: 'Hello' });
      expect(result.delivered).toBe(0);
    });
  });

  describe('getDisputes', () => {
    it('should return disputes', async () => {
      mockPrisma.dispute.findMany.mockResolvedValue([]);
      const result = await controller.getDisputes();
      expect(result).toEqual([]);
    });
  });

  describe('resolveDispute', () => {
    it('should resolve a dispute', async () => {
      mockPrisma.dispute.update.mockResolvedValue({ id: 'd1', resolution: 'Resolved' });
      const result = await controller.resolveDispute('d1', { resolution: 'Payment released to freelancer' });
      expect(result.resolution).toBe('Resolved');
    });
  });
});
