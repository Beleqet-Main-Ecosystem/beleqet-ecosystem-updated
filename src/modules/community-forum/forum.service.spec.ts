import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ForumService } from './forum.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ForumQueryDto, ForumSortOrder } from './dto/forum-query.dto';

const mockPrisma = {
  forumThread: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  forumReply: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  },
  forumUpvote: {
    create: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  },
};

describe('ForumService', () => {
  let service: ForumService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ForumService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ForumService>(ForumService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createThread', () => {
    const dto: CreateThreadDto = {
      title: 'How to get started with NestJS?',
      content: 'I am a beginner looking for advice on learning NestJS and TypeScript.',
      tags: ['nestjs', 'typescript'],
      isAnonymous: false,
    };

    it('should create a thread with the given display name', async () => {
      const expected = { id: 'thread-1', ...dto, userId: 'user-1', userDisplayName: 'John Doe' };
      mockPrisma.forumThread.create.mockResolvedValue(expected);

      const result = await service.createThread('user-1', 'John Doe', dto);
      expect(result).toEqual(expected);
      expect(mockPrisma.forumThread.create).toHaveBeenCalledWith({
        data: {
          title: dto.title,
          content: dto.content,
          tags: dto.tags,
          userId: 'user-1',
          userDisplayName: 'John Doe',
          isAnonymous: false,
        },
        include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
      });
    });

    it('should create an anonymous thread with Deleted User', async () => {
      const anonDto = { ...dto, isAnonymous: true };
      mockPrisma.forumThread.create.mockResolvedValue({ ...anonDto, userDisplayName: 'Deleted User' });

      const result = await service.createThread('user-1', 'John Doe', anonDto);
      expect(result.userDisplayName).toBe('Deleted User');
    });
  });

  describe('findThreads', () => {
    it('should return paginated threads', async () => {
      const threads = [{ id: 't1', title: 'Test', _count: { replies: 3 } }];
      mockPrisma.forumThread.findMany.mockResolvedValue(threads);
      mockPrisma.forumThread.count.mockResolvedValue(1);

      const query: ForumQueryDto = { page: 1, limit: 20, sort: ForumSortOrder.LATEST };
      const result = await service.findThreads(query);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].replyCount).toBe(3);
      expect(result.pagination.total).toBe(1);
    });

    it('should filter by search term', async () => {
      mockPrisma.forumThread.findMany.mockResolvedValue([]);
      mockPrisma.forumThread.count.mockResolvedValue(0);

      await service.findThreads({ search: 'nestjs' });

      expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              expect.objectContaining({ title: expect.objectContaining({ contains: 'nestjs' }) }),
            ]),
          }),
        }),
      );
    });

    it('should filter by tag', async () => {
      mockPrisma.forumThread.findMany.mockResolvedValue([]);
      mockPrisma.forumThread.count.mockResolvedValue(0);

      await service.findThreads({ tag: 'nestjs' });

      expect(mockPrisma.forumThread.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ tags: { has: 'nestjs' } }),
        }),
      );
    });
  });

  describe('findThreadById', () => {
    it('should return a thread if found', async () => {
      const thread = { id: 't1', title: 'Test', tags: [], content: 'test', _count: { replies: 0 } };
      mockPrisma.forumThread.findUnique.mockResolvedValue(thread);

      const result = await service.findThreadById('t1');
      expect(result.id).toBe('t1');
      expect(result.replyCount).toBe(0);
      expect(result).not.toHaveProperty('_count');
    });

    it('should throw NotFoundException if thread not found', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue(null);
      await expect(service.findThreadById('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createReply', () => {
    const dto: CreateReplyDto = { content: 'Great question!' };

    it('should create a reply and increment replyCount', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1', isLocked: false });
      mockPrisma.forumReply.create.mockResolvedValue({ id: 'r1', content: dto.content, threadId: 't1' });
      mockPrisma.forumThread.update.mockResolvedValue({});

      const result = await service.createReply('user-1', 'John Doe', 't1', dto);
      expect(result.id).toBe('r1');
      expect(mockPrisma.forumThread.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { replyCount: { increment: 1 } },
      });
    });

    it('should throw NotFoundException if thread missing', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue(null);
      await expect(service.createReply('user-1', 'John', 't1', dto)).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if thread is locked', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1', isLocked: true });
      await expect(service.createReply('user-1', 'John', 't1', dto)).rejects.toThrow(ForbiddenException);
    });

    it('should validate parent reply existence', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1', isLocked: false });
      mockPrisma.forumReply.findUnique.mockResolvedValue(null);
      await expect(
        service.createReply('user-1', 'John', 't1', { ...dto, parentReplyId: 'invalid' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findRepliesByThread', () => {
    it('should throw NotFoundException if thread missing', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue(null);
      await expect(service.findRepliesByThread('invalid')).rejects.toThrow(NotFoundException);
    });

    it('should return replies with nested childReplies', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1' });
      const replies = [{ id: 'r1', childReplies: [{ id: 'r2' }] }];
      mockPrisma.forumReply.findMany.mockResolvedValue(replies);

      const result = await service.findRepliesByThread('t1');
      expect(result).toEqual(replies);
    });
  });

  describe('upvoteThread', () => {
    it('should throw NotFoundException if thread missing', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue(null);
      await expect(service.upvoteThread('user-1', 'invalid')).rejects.toThrow(NotFoundException);
    });

    it('should create upvote and increment count', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1', upvoteCount: 5 });
      mockPrisma.forumUpvote.findUnique.mockResolvedValue(null);
      mockPrisma.forumUpvote.create.mockResolvedValue({});
      mockPrisma.forumThread.update.mockResolvedValue({});

      const result = await service.upvoteThread('user-1', 't1');
      expect(result).toEqual({ upvoted: true, upvoteCount: 6 });
    });

    it('should remove upvote and decrement count', async () => {
      mockPrisma.forumThread.findUnique.mockResolvedValue({ id: 't1', upvoteCount: 5 });
      mockPrisma.forumUpvote.findUnique.mockResolvedValue({ id: 'uv-1' });
      mockPrisma.forumUpvote.delete.mockResolvedValue({});
      mockPrisma.forumThread.update.mockResolvedValue({});

      const result = await service.upvoteThread('user-1', 't1');
      expect(result).toEqual({ upvoted: false, upvoteCount: 4 });
    });
  });

  describe('upvoteReply', () => {
    it('should throw NotFoundException if reply missing', async () => {
      mockPrisma.forumReply.findUnique.mockResolvedValue(null);
      await expect(service.upvoteReply('user-1', 'invalid')).rejects.toThrow(NotFoundException);
    });

    it('should create upvote and increment count', async () => {
      mockPrisma.forumReply.findUnique.mockResolvedValue({ id: 'r1', upvoteCount: 3 });
      mockPrisma.forumUpvote.findUnique.mockResolvedValue(null);
      mockPrisma.forumUpvote.create.mockResolvedValue({});
      mockPrisma.forumReply.update.mockResolvedValue({});

      const result = await service.upvoteReply('user-1', 'r1');
      expect(result).toEqual({ upvoted: true, upvoteCount: 4 });
    });
  });

  describe('anonymizeUserData', () => {
    it('should update all threads and replies to Deleted User', async () => {
      mockPrisma.forumThread.updateMany.mockResolvedValue({ count: 3 });
      mockPrisma.forumReply.updateMany.mockResolvedValue({ count: 5 });

      await service.anonymizeUserData('user-1');

      expect(mockPrisma.forumThread.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { userDisplayName: 'Deleted User', isAnonymous: true },
      });
      expect(mockPrisma.forumReply.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { userDisplayName: 'Deleted User', isAnonymous: true },
      });
    });
  });
});
