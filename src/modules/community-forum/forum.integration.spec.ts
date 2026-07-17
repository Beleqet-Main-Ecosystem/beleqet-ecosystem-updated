import { Test, TestingModule } from '@nestjs/testing';
import { ForumService } from './forum.service';
import { CommunityForumModule } from './forum.module';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';

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

describe('Community Forum (integration)', () => {
  let service: ForumService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, CommunityForumModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma as any)
      .compile();

    service = module.get<ForumService>(ForumService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Thread lifecycle', () => {
    it('should create and then retrieve a thread', async () => {
      const mockThread = {
        id: 'thread-1',
        title: 'Integration Test Thread',
        content: 'This is an integration test thread for the forum module.',
        tags: ['test', 'integration'],
        userId: 'user-1',
        userDisplayName: 'Test User',
        isAnonymous: false,
        upvoteCount: 0,
        replyCount: 0,
        isPinned: false,
        isLocked: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { replies: 0 },
      };

      (prisma.forumThread.create as jest.Mock).mockResolvedValue(mockThread);
      (prisma.forumThread.findUnique as jest.Mock).mockResolvedValue(mockThread);
      (prisma.forumThread.findMany as jest.Mock).mockResolvedValue([{ ...mockThread, _count: { replies: 0 } }]);
      (prisma.forumThread.count as jest.Mock).mockResolvedValue(1);

      const created = await service.createThread('user-1', 'Test User', {
        title: mockThread.title,
        content: mockThread.content,
        tags: mockThread.tags,
      });
      expect(created.title).toBe('Integration Test Thread');

      const found = await service.findThreadById('thread-1');
      expect(found.id).toBe('thread-1');
    });

    it('should create a reply and update reply count', async () => {
      (prisma.forumThread.findUnique as jest.Mock).mockResolvedValue({ id: 't1', isLocked: false });
      (prisma.forumReply.create as jest.Mock).mockResolvedValue({
        id: 'r1',
        content: 'Test reply',
        threadId: 't1',
        userDisplayName: 'Test User',
      });
      (prisma.forumThread.update as jest.Mock).mockResolvedValue({});

      const reply = await service.createReply('user-1', 'Test User', 't1', { content: 'Test reply' });
      expect(reply.content).toBe('Test reply');
      expect(prisma.forumThread.update).toHaveBeenCalledWith({
        where: { id: 't1' },
        data: { replyCount: { increment: 1 } },
      });
    });

    it('should toggle upvote on a thread', async () => {
      (prisma.forumThread.findUnique as jest.Mock).mockResolvedValue({ id: 't1', upvoteCount: 0 });
      (prisma.forumUpvote.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.forumUpvote.create as jest.Mock).mockResolvedValue({});
      (prisma.forumThread.update as jest.Mock).mockResolvedValue({});

      const result = await service.upvoteThread('user-1', 't1');
      expect(result.upvoted).toBe(true);
      expect(result.upvoteCount).toBe(1);
    });

    it('should toggle downvote (remove upvote) on a thread', async () => {
      (prisma.forumThread.findUnique as jest.Mock).mockResolvedValue({ id: 't1', upvoteCount: 1 });
      (prisma.forumUpvote.findUnique as jest.Mock).mockResolvedValue({ id: 'uv-1' });
      (prisma.forumUpvote.delete as jest.Mock).mockResolvedValue({});
      (prisma.forumThread.update as jest.Mock).mockResolvedValue({});

      const result = await service.upvoteThread('user-1', 't1');
      expect(result.upvoted).toBe(false);
      expect(result.upvoteCount).toBe(0);
    });
  });

  describe('GDPR anonymization', () => {
    it('should anonymize all user content', async () => {
      (prisma.forumThread.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
      (prisma.forumReply.updateMany as jest.Mock).mockResolvedValue({ count: 3 });

      await service.anonymizeUserData('user-1');

      expect(prisma.forumThread.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { userDisplayName: 'Deleted User', isAnonymous: true },
      });
      expect(prisma.forumReply.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        data: { userDisplayName: 'Deleted User', isAnonymous: true },
      });
    });
  });
});
