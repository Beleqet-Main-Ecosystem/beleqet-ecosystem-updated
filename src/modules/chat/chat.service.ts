import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessageMetadata } from './message-metadata.interface';
/**
 * Service handling chat room creation and encrypted message persistence.
 *
 * SECURITY NOTE:
 * The `content` field always stores AES-GCM ciphertext (Base64).
 * Plaintext never touches the server. The IV is stored in `metadata.iv`.
 * Only the two communicating clients can derive the shared key and decrypt.
 */
@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create or fetch a chat room between two users (e.g. for a freelance contract).
   * @param userId1 First participant user ID
   * @param userId2 Second participant user ID
   * @param contractId Optional contract ID to link the room to
   */
  async createOrGetRoom(userId1: string, userId2: string, contractId?: string) {
    if (contractId) {
      const existing = await this.prisma.chatRoom.findUnique({
        where: { contractId },
        include: {
          participants: true,
          messages: { take: 1, orderBy: { createdAt: 'desc' } }
        }
      });
      if (existing) return existing;
    }

    const room = await this.prisma.chatRoom.create({
      data: {
        contractId,
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }]
        }
      },
      include: { participants: true, messages: true }
    });

    this.logger.log(`Created ChatRoom ${room.id} for users ${userId1} and ${userId2}`);
    return room;
  }

  /**
   * Persist an encrypted message to the database.
   *
   * @param roomId  The chat room ID
   * @param senderId The sender's user ID
   * @param content AES-GCM Base64 ciphertext (server must never decrypt this)
   * @param metadata Optional metadata — must include `iv` (hex) when `encrypted: true`
   */
  async saveMessage(
    roomId: string,
    senderId: string,
    content: string,
    metadata?: MessageMetadata
  ) {
    // Verify the sender is a participant in this room
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } }
    });
    if (!participant) throw new NotFoundException('User is not a participant of this chat room');

    return this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content,   // Encrypted ciphertext — server stores but cannot read
        metadata   // Contains { encrypted: true, iv: "..." } for E2EE messages
      },
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });
  }

  /**
   * Fetch encrypted message history for a room.
   * Messages are returned as-is (still encrypted); the client decrypts locally.
   *
   * @param roomId The chat room ID
   * @param userId The requesting user's ID (must be a participant)
   * @param take   Maximum number of messages to return (default 50)
   */
  async getRoomMessages(roomId: string, userId: string, take = 50) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });
    if (!participant) throw new NotFoundException('Unauthorized');

    return this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        sender: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatarUrl: true,
            role: true
          }
        }
      }
    });
  }
}
