import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { chatMessageNotice } from '../notifications/notices';
import { UserNotifier } from '../notifications/user-notifier';

/** Structured metadata attached to non-plain-text chat messages */
export type MessageMetadata =
  { type: 'file'; url: string; name: string } | { type: 'video_call'; link: string };

/** Someone who read the conversation this recently is reading it now: no notice for them. */
const CHAT_READING_MS = 5 * 60 * 1000;

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly notifier?: UserNotifier,
  ) {}

  /**
   * Create or fetch a chat room between two users. Only people who already work together
   * can open one: the two sides of a contract, or an applicant and the employer they applied to.
   */
  async createOrGetRoom(userId1: string, userId2: string, contractId?: string) {
    let jobId: string | undefined;
    if (!userId2 || userId1 === userId2)
      throw new BadRequestException('Choose someone else to message');

    if (contractId) {
      const contract = await this.prisma.contract.findUnique({
        where: { id: contractId },
        select: { clientId: true, freelancerId: true },
      });
      const parties = [contract?.clientId, contract?.freelancerId];
      if (!contract || !parties.includes(userId1) || !parties.includes(userId2)) {
        throw new ForbiddenException('You can only message the other side of your contract');
      }
      const existing = await this.prisma.chatRoom.findUnique({
        where: { contractId },
        include: { participants: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (existing) return existing;
    } else {
      const applied = await this.prisma.application.findFirst({
        where: {
          OR: [
            { userId: userId1, job: { company: { userId: userId2 } } },
            { userId: userId2, job: { company: { userId: userId1 } } },
          ],
        },
        select: { jobId: true },
      });
      if (!applied)
        throw new ForbiddenException(
          'You can message employers you applied to, and their applicants',
        );
      jobId = applied.jobId;
      const existing = await this.prisma.chatRoom.findFirst({
        where: {
          contractId: null,
          AND: [
            { participants: { some: { userId: userId1 } } },
            { participants: { some: { userId: userId2 } } },
          ],
        },
        include: { participants: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (existing) return existing;
    }

    // Create new room
    const room = await this.prisma.chatRoom.create({
      data: {
        contractId,
        jobId,
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }],
        },
      },
      include: { participants: true, messages: true },
    });

    this.logger.log(`Created new ChatRoom ${room.id} for users ${userId1} and ${userId2}`);
    return room;
  }

  /** Save a message to DB and return it populated */
  async saveMessage(roomId: string, senderId: string, content: string, metadata?: MessageMetadata) {
    // Verify user is in room
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } },
    });
    if (!participant) throw new NotFoundException('User is not a participant of this chat room');

    const message = await this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content,
        metadata,
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
        },
      },
    });
    await this.tellOthers(message);
    return message;
  }

  /**
   * Tells the others in the room about a message they haven't seen: once per batch of unread
   * messages, and not while they're reading the conversation, so a busy chat doesn't flood them.
   */
  private async tellOthers(message: {
    id: string;
    roomId: string;
    senderId: string;
    content: string;
    metadata: unknown;
    sender: { firstName: string; lastName: string };
  }) {
    if (!this.notifier) return;
    try {
      const others = await this.prisma.chatParticipant.findMany({
        where: { roomId: message.roomId, userId: { not: message.senderId } },
        select: { userId: true, lastReadAt: true },
      });
      const sender = `${message.sender.firstName} ${message.sender.lastName}`.trim();
      const kind = (message.metadata as { type?: string } | null)?.type;
      const preview =
        kind === 'file'
          ? '📎 Sent a file'
          : kind === 'video_call'
            ? '📹 Started a video call'
            : message.content;
      for (const other of others) {
        if (other.lastReadAt && Date.now() - other.lastReadAt.getTime() < CHAT_READING_MS) continue;
        const earlierUnread = await this.prisma.message.count({
          where: {
            roomId: message.roomId,
            id: { not: message.id },
            senderId: { not: other.userId },
            ...(other.lastReadAt ? { createdAt: { gt: other.lastReadAt } } : {}),
          },
        });
        if (earlierUnread > 0) continue;
        await this.notifier.notify(
          other.userId,
          chatMessageNotice(sender, preview, message.roomId),
        );
      }
    } catch (err) {
      this.logger.warn(`Chat notice for room ${message.roomId} failed: ${(err as Error).message}`);
    }
  }

  /** Fetch message history */
  async getRoomMessages(roomId: string, userId: string, take = 50) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!participant) throw new NotFoundException('Unauthorized');

    // The latest `take` messages, returned oldest first for display.
    const latest = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'desc' },
      take,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
        },
      },
    });
    return latest.reverse();
  }

  /** List user chat rooms */
  async getUserRooms(userId: string) {
    const participants = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        room: {
          include: {
            participants: {
              include: {
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    avatarUrl: true,
                    role: true,
                  },
                },
              },
            },
            messages: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
      orderBy: { joinedAt: 'desc' },
    });

    // Newest conversation first, by its last message.
    const latest = (r: (typeof participants)[number]['room']) =>
      (r.messages[0]?.createdAt ?? r.createdAt).getTime();
    const rooms = participants.map((p) => p.room).sort((a, b) => latest(b) - latest(a));
    const contractIds = rooms.map((r) => r.contractId).filter((id): id is string => Boolean(id));
    const jobIds = rooms.map((r) => r.jobId).filter((id): id is string => Boolean(id));

    const [contracts, jobs] = await Promise.all([
      contractIds.length
        ? this.prisma.contract.findMany({
            where: { id: { in: contractIds } },
            select: { id: true, freelanceJob: { select: { title: true } } },
          })
        : [],
      jobIds.length
        ? this.prisma.job.findMany({
            where: { id: { in: jobIds } },
            select: { id: true, title: true },
          })
        : [],
    ]);
    const contractMap = new Map(contracts.map((c) => [c.id, c]));
    const jobMap = new Map(jobs.map((j) => [j.id, j]));
    const lastRead = new Map(participants.map((p) => [p.roomId, p.lastReadAt]));
    return rooms.map((r) => {
      const last = r.messages[0];
      const readAt = lastRead.get(r.id);
      return {
        ...r,
        contract: r.contractId ? (contractMap.get(r.contractId) ?? null) : null,
        job: r.jobId ? (jobMap.get(r.jobId) ?? null) : null,
        unread: Boolean(last && last.senderId !== userId && (!readAt || last.createdAt > readAt)),
      };
    });
  }

  /** Mark a room read for this user, so it stops showing as unread. */
  async markRead(roomId: string, userId: string) {
    const { count } = await this.prisma.chatParticipant.updateMany({
      where: { roomId, userId },
      data: { lastReadAt: new Date() },
    });
    if (!count) throw new NotFoundException('Unauthorized');
    return { ok: true };
  }
}
