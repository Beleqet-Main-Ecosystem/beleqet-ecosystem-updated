import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateThreadDto } from './dto/create-thread.dto';
import { CreateReplyDto } from './dto/create-reply.dto';
import { ForumQueryDto } from './dto/forum-query.dto';

@Injectable()
export class ForumService {
  private readonly logger = new Logger(ForumService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createThread(userId: string, userDisplayName: string, dto: CreateThreadDto) {
    const displayName = dto.isAnonymous ? 'Deleted User' : userDisplayName;
    return this.prisma.forumThread.create({
      data: {
        title: dto.title,
        content: dto.content,
        tags: dto.tags ?? [],
        userId,
        userDisplayName: displayName,
        isAnonymous: dto.isAnonymous ?? false,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });
  }

  async findThreads(query: ForumQueryDto) {
    const { page = 1, limit = 20, sort = 'latest', search, tag } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { content: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (tag) {
      where.tags = { has: tag };
    }

    const orderBy: any =
      sort === 'popular'
        ? [{ upvoteCount: 'desc' }, { createdAt: 'desc' }]
        : sort === 'unanswered'
          ? [{ replyCount: 'asc' }, { createdAt: 'desc' }]
          : [{ isPinned: 'desc' }, { createdAt: 'desc' }];

    const [items, total] = await Promise.all([
      this.prisma.forumThread.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          _count: { select: { replies: true } },
        },
      }),
      this.prisma.forumThread.count({ where }),
    ]);

    return {
      items: items.map(({ _count, ...thread }) => ({
        ...thread,
        replyCount: _count.replies,
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findThreadById(threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({
      where: { id: threadId },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        _count: { select: { replies: true } },
      },
    });

    if (!thread) throw new NotFoundException('forum.error.threadNotFound');

    const { _count, ...data } = thread;
    return { ...data, replyCount: _count.replies };
  }

  async createReply(userId: string, userDisplayName: string, threadId: string, dto: CreateReplyDto) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('forum.error.threadNotFound');
    if (thread.isLocked) throw new ForbiddenException('forum.error.threadLocked');

    if (dto.parentReplyId) {
      const parent = await this.prisma.forumReply.findUnique({ where: { id: dto.parentReplyId } });
      if (!parent || parent.threadId !== threadId) {
        throw new NotFoundException('forum.error.parentReplyNotFound');
      }
    }

    const displayName = dto.isAnonymous ? 'Deleted User' : userDisplayName;

    const reply = await this.prisma.forumReply.create({
      data: {
        content: dto.content,
        threadId,
        parentReplyId: dto.parentReplyId ?? null,
        userId,
        userDisplayName: displayName,
        isAnonymous: dto.isAnonymous ?? false,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } } },
    });

    await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { replyCount: { increment: 1 } },
    });

    return reply;
  }

  async findRepliesByThread(threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('forum.error.threadNotFound');

    return this.prisma.forumReply.findMany({
      where: { threadId, parentReplyId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
        childReplies: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
          },
        },
      },
    });
  }

  async upvoteThread(userId: string, threadId: string) {
    const thread = await this.prisma.forumThread.findUnique({ where: { id: threadId } });
    if (!thread) throw new NotFoundException('forum.error.threadNotFound');

    const existing = await this.prisma.forumUpvote.findUnique({
      where: { userId_threadId: { userId, threadId } },
    });

    if (existing) {
      await this.prisma.forumUpvote.delete({ where: { id: existing.id } });
      await this.prisma.forumThread.update({
        where: { id: threadId },
        data: { upvoteCount: { decrement: 1 } },
      });
      return { upvoted: false, upvoteCount: Math.max(0, thread.upvoteCount - 1) };
    }

    await this.prisma.forumUpvote.create({ data: { userId, threadId } });
    await this.prisma.forumThread.update({
      where: { id: threadId },
      data: { upvoteCount: { increment: 1 } },
    });
    return { upvoted: true, upvoteCount: thread.upvoteCount + 1 };
  }

  async upvoteReply(userId: string, replyId: string) {
    const reply = await this.prisma.forumReply.findUnique({ where: { id: replyId } });
    if (!reply) throw new NotFoundException('forum.error.replyNotFound');

    const existing = await this.prisma.forumUpvote.findUnique({
      where: { userId_replyId: { userId, replyId } },
    });

    if (existing) {
      await this.prisma.forumUpvote.delete({ where: { id: existing.id } });
      await this.prisma.forumReply.update({
        where: { id: replyId },
        data: { upvoteCount: { decrement: 1 } },
      });
      return { upvoted: false, upvoteCount: Math.max(0, reply.upvoteCount - 1) };
    }

    await this.prisma.forumUpvote.create({ data: { userId, replyId } });
    await this.prisma.forumReply.update({
      where: { id: replyId },
      data: { upvoteCount: { increment: 1 } },
    });
    return { upvoted: true, upvoteCount: reply.upvoteCount + 1 };
  }

  async anonymizeUserData(userId: string) {
    const deletedName = 'Deleted User';
    await this.prisma.forumThread.updateMany({
      where: { userId },
      data: { userDisplayName: deletedName, isAnonymous: true },
    });
    await this.prisma.forumReply.updateMany({
      where: { userId },
      data: { userDisplayName: deletedName, isAnonymous: true },
    });
    this.logger.log(`Anonymized forum data for user ${userId}`);
  }
}
