import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/encryption/encryption.service';
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) { }

  /** Create or fetch a chat room between two users (e.g. for a freelance contract) */
  async createOrGetRoom(userId1: string, userId2: string, contractId?: string) {
    if (contractId) {
      const existing = await this.prisma.chatRoom.findUnique({
        where: { contractId },
        include: { participants: true, messages: { take: 1, orderBy: { createdAt: 'desc' } } }
      });
      if (existing) return existing;
    }

    // Create new room
    const room = await this.prisma.chatRoom.create({
      data: {
        contractId,
        participants: {
          create: [{ userId: userId1 }, { userId: userId2 }]
        }
      },
      include: { participants: true, messages: true }
    });

    this.logger.log(`Created new ChatRoom ${room.id} for users ${userId1} and ${userId2}`);
    return room;
  }

  /**
   * Encrypts and stores a chat message.
   *
   * Only encrypted content is persisted in PostgreSQL.
   *
   * @param roomId Chat room identifier.
   * @param senderId Sender's user ID.
   * @param content Plaintext message.
   * @param metadata Optional message metadata.
   * @returns The saved message with sender details.
   */
  async saveMessage(roomId: string, senderId: string, content: string, metadata?: any) {
    // Verify user is in room
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId: senderId } }
    });
    if (!participant) throw new NotFoundException('User is not a participant of this chat room');

    if (!content || !content.trim()) {
      throw new BadRequestException('Message content cannot be empty.');
    }
    const encryptedContent = this.encryptionService.encrypt(content);

    return this.prisma.message.create({
      data: {
        roomId,
        senderId,
        content: encryptedContent,
        metadata
      },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, role: true } }
      }
    });
  }

  /**
   * Retrieves and decrypts chat messages for an authorized participant.
   *
   * Messages are stored encrypted in PostgreSQL and are decrypted
   * before being returned to the client.
   *
   * @param roomId Chat room identifier.
   * @param userId Authenticated user's ID.
   * @param take Number of messages to retrieve.
   * @returns Decrypted chat history.
   */
  async getRoomMessages(roomId: string, userId: string, take = 50) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { roomId_userId: { roomId, userId } }
    });

    if (!participant) {
      throw new NotFoundException('Unauthorized');
    }

    const messages = await this.prisma.message.findMany({
      where: { roomId },
      orderBy: { createdAt: 'asc' },
      take,
      include: {
        sender: {
          select: {
            id: true, firstName: true, lastName: true, avatarUrl: true, role: true,
          },
        },
      },
    });

    return messages.map((message) => {
      try {
        return {
          ...message,
          content: this.encryptionService.decrypt(message.content),
        };
      } catch (error) {
        this.logger.error(
          `Failed to decrypt message ${message.id}`,
        );

        return {
          ...message,
          content: '[Unable to decrypt message]',
        };
      }
    });
  }
}
