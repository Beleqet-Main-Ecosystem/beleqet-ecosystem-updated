import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

/** Structured metadata attached to non-plain-text chat messages */
export type MessageMetadata =
  { type: 'file'; url: string; name: string } | { type: 'video_call'; link: string };

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Create or fetch a chat room between two users (e.g. for a freelance contract) */
  async createOrGetRoom(userId1: string, userId2: string, contractId?: string) {
    if (contractId) {
      const existing = await this.prisma.chatRoom.findUnique({
        where: { contractId },
        include: { participants: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      });
      if (existing) return existing;
    }

    // Create new room
    const room = await this.prisma.chatRoom.create({
      data: {
        contractId,
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

    return this.prisma.message.create({
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
  }

  /** Fetch message history */
  async getRoomMessages(roomId: string, userId: string, take = 50) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!participant) throw new NotFoundException('Unauthorized');

    return this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' }, // usually UI wants asc, but depends on frontend
      take,
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
        },
      },
    });
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
                  select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true },
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

    const rooms = participants.map((p) => p.room);
    const contractIds = rooms
      .map((r) => r.contractId)
      .filter((id): id is string => Boolean(id));

    if (contractIds.length > 0) {
      const contracts = await this.prisma.contract.findMany({
        where: { id: { in: contractIds } },
        select: {
          id: true,
          freelanceJob: { select: { title: true } },
        },
      });
      const contractMap = new Map(contracts.map((c) => [c.id, c]));
      return rooms.map((r) => ({
        ...r,
        contract: r.contractId ? contractMap.get(r.contractId) ?? null : null,
      }));
    }

    return rooms;
  }
}
